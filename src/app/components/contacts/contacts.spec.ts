import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { Contacts } from './contacts';
import { ConnectedUserService } from '../../services/connected-user.service';
import { LocalDatabaseService } from '../../services/local-database.service';
import { contactsFile } from '../../utils/contacts-file.util';
import type { Contact } from '../../models/account';
import { MALFORMED_PUBLIC_KEY_MESSAGE } from '../../utils/public-key.util';

const HUGO_PK = '02' + 'aa'.repeat(32);

function keyFor(name: string): string {
  const nameInHex = Array.from(name, (letter) => letter.codePointAt(0)!.toString(16).padStart(4, '0')).join('');
  return '03' + nameInHex.padEnd(64, '0').slice(0, 64);
}

function contactNamed(name: string): Contact {
  return { name, pk: keyFor(name), url: 'https://trifouillis.fr', type: 'citizen' };
}

function notAContactsFile(): File {
  return new File(['pas du JSON'], 'photo.jpg');
}

function fileOf(contacts: Contact[]): File {
  return new File([contactsFile(contacts)], 'contacts.json', { type: 'application/json' });
}

describe('Contacts', () => {
  let component: Contacts;
  let fixture: ComponentFixture<Contacts>;
  let account: { name: string; publickey: string; contacts: Contact[] };
  let connectedAccount: typeof account | null;
  let localDBSpy: jasmine.SpyObj<Pick<LocalDatabaseService, 'saveUser'>>;

  beforeEach(async () => {
    account = { name: 'Hugo Ménard', publickey: HUGO_PK, contacts: [] };
    connectedAccount = account;
    localDBSpy = jasmine.createSpyObj('LocalDatabaseService', ['saveUser']);
    localDBSpy.saveUser.and.resolveTo();
    await TestBed.configureTestingModule({
      imports: [Contacts],
      providers: [
        provideRouter([]),
        {
          provide: ConnectedUserService,
          useValue: { getConnectedUser: () => connectedAccount, getSecretKey: () => '' },
        },
        { provide: LocalDatabaseService, useValue: localDBSpy },
      ],
    })
    .compileComponents();
  });

  function createComponent() {
    fixture = TestBed.createComponent(Contacts);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('constructor', () => {
    it('should send a visitor with no open account to the account choice', () => {
      connectedAccount = null;
      const navigate = spyOn(TestBed.inject(Router), 'navigate');

      createComponent();

      expect(navigate).toHaveBeenCalledWith(['/user-selection']);
    });
  });

  it('should create', () => {
    createComponent();

    expect(component).toBeTruthy();
  });

  describe('visibleContacts', () => {
    it('should sort the contacts by name, ignoring case and accents', () => {
      account.contacts = ['fanny', 'Émile', 'Zoé', 'denis'].map(contactNamed);
      createComponent();

      expect(component.visibleContacts().map((contact) => contact.name)).toEqual([
        'denis',
        'Émile',
        'fanny',
        'Zoé',
      ]);
    });

    it('should keep only the contacts whose name contains the search, ignoring case and accents', () => {
      account.contacts = ['fanny', 'Émile', 'Rémi', 'denis'].map(contactNamed);
      createComponent();

      component.search.set('EMI');

      expect(component.visibleContacts().map((contact) => contact.name)).toEqual(['Émile', 'Rémi']);
    });
  });

  describe('exportContacts', () => {
    afterEach(() => jasmine.clock().uninstall());

    function exportedFileName(): string {
      createComponent();
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 10, 6, 0, 30));
      let downloadedFileName = '';
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        downloadedFileName = this.download;
      });
      component.exportContacts();
      return downloadedFileName;
    }

    it('should download a file named after the user and the day', () => {
      expect(exportedFileName()).toBe('contacts-hugo-menard-2026-11-06.json');
    });

    it('should keep only the letters and digits of the name in the file name', () => {
      account.name = ' Jean-Luc ! ';

      expect(exportedFileName()).toBe('contacts-jean-luc-2026-11-06.json');
    });

    it('should keep the letters of any alphabet in the file name', () => {
      account.name = 'Ζωή Cœur';

      expect(exportedFileName()).toBe('contacts-ζωη-cœur-2026-11-06.json');
    });

    it('should name the file after the day alone when the name has no letter', () => {
      account.name = '';

      expect(exportedFileName()).toBe('contacts-2026-11-06.json');
    });

    it('should keep the file available for a minute, for the phones that download it late', () => {
      const revokeObjectURL = spyOn(URL, 'revokeObjectURL');
      exportedFileName();

      jasmine.clock().tick(59_999);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      expect(revokeObjectURL).toHaveBeenCalled();
    });
  });

  describe('importContacts', () => {
    it('should add the contacts that pass the checks of the contact form', async () => {
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé')]));

      expect(account.contacts).toEqual([contactNamed('Zoé')]);
    });

    it('should name each refused contact with its reason', async () => {
      createComponent();

      await component.importContacts(fileOf([{ ...contactNamed('Zoé'), pk: 'abc' }, contactNamed('Denis')]));

      expect(account.contacts).toEqual([contactNamed('Denis')]);
      expect(component.importReport()?.refused).toEqual([{ name: 'Zoé', reason: MALFORMED_PUBLIC_KEY_MESSAGE }]);
    });

    it('should skip the contacts already known by their key, and count them', async () => {
      account.contacts = [contactNamed('Zoé')];
      createComponent();

      await component.importContacts(fileOf([{ ...contactNamed('Zoé'), name: 'Zoé G.' }, contactNamed('Denis')]));

      expect(account.contacts).toEqual([contactNamed('Zoé'), contactNamed('Denis')]);
      expect(component.importReport()).toEqual({ added: 1, alreadyKnown: 1, refused: [] });
    });

    it('should add a contact listed twice in the file only once', async () => {
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé'), contactNamed('Zoé')]));

      expect(account.contacts).toEqual([contactNamed('Zoé')]);
      expect(component.importReport()).toEqual({ added: 1, alreadyKnown: 1, refused: [] });
    });

    it('should skip my own key', async () => {
      createComponent();

      await component.importContacts(fileOf([{ ...contactNamed('Moi'), pk: HUGO_PK }]));

      expect(account.contacts).toEqual([]);
      expect(component.importReport()).toEqual({ added: 0, alreadyKnown: 1, refused: [] });
    });

    it('should save the account once, with every added contact', async () => {
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé'), contactNamed('Denis')]));

      expect(localDBSpy.saveUser).toHaveBeenCalledTimes(1);
      expect(localDBSpy.saveUser.calls.mostRecent().args[0].contacts).toEqual([contactNamed('Zoé'), contactNamed('Denis')]);
    });

    it('should not save the account when no contact was added', async () => {
      account.contacts = [contactNamed('Zoé')];
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé')]));

      expect(localDBSpy.saveUser).not.toHaveBeenCalled();
    });

    it('should say that the file is not a contacts file', async () => {
      createComponent();

      await component.importContacts(notAContactsFile());

      expect(component.importError()).toBe("Ce fichier n'est pas un fichier de contacts.");
      expect(component.importReport()).toBeNull();
    });

    it('should refuse a file too big to be a contacts file, without reading it', async () => {
      createComponent();
      const hugeFile = new File(['x'.repeat(1_000_001)], 'video.mp4');
      const text = spyOn(hugeFile, 'text').and.callThrough();

      await component.importContacts(hugeFile);

      expect(text).not.toHaveBeenCalled();
      expect(component.importError()).toBe('Ce fichier est trop gros pour être un fichier de contacts.');
    });

    it('should say that the file could not be read', async () => {
      createComponent();
      const unreadableFile = fileOf([contactNamed('Zoé')]);
      spyOn(unreadableFile, 'text').and.rejectWith(new DOMException('moved', 'NotReadableError'));
      spyOn(console, 'error');

      await component.importContacts(unreadableFile);

      expect(component.importError()).toBe('Impossible de lire ce fichier.');
    });

    it('should clear the previous error once a valid file is imported', async () => {
      createComponent();
      await component.importContacts(notAContactsFile());

      await component.importContacts(fileOf([contactNamed('Zoé')]));

      expect(component.importError()).toBe('');
    });

    it('should clear the previous report when the next file is unreadable', async () => {
      createComponent();
      await component.importContacts(fileOf([contactNamed('Zoé')]));

      await component.importContacts(notAContactsFile());

      expect(component.importReport()).toBeNull();
    });

    it('should name a refused contact without a name by its shortened key', async () => {
      createComponent();

      await component.importContacts(fileOf([{ ...contactNamed('Zoé'), name: '' }]));

      expect(component.importReport()?.refused[0].name).toBe(component.truncate(keyFor('Zoé')));
    });

    it('should keep the contacts as they were when they could not be saved', async () => {
      localDBSpy.saveUser.and.rejectWith(new Error('quota exceeded'));
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé')]));

      expect(account.contacts).toEqual([]);
      expect(component.importError()).toBe("Les contacts n'ont pas pu être enregistrés sur cet appareil : rien n'a été importé.");
      expect(component.importReport()).toBeNull();
    });
  });

  describe('importChosenFile', () => {
    function filePickerHolding(file: File): HTMLInputElement {
      const picker = fixture.nativeElement.querySelector('.import-file-picker') as HTMLInputElement;
      const chosenFiles = new DataTransfer();
      chosenFiles.items.add(file);
      picker.files = chosenFiles.files;
      return picker;
    }

    it('should import the file chosen in the file picker', async () => {
      createComponent();

      await component.importChosenFile(filePickerHolding(fileOf([contactNamed('Zoé')])));

      expect(account.contacts).toEqual([contactNamed('Zoé')]);
    });

    it('should do nothing when the choice of a file was cancelled', async () => {
      createComponent();
      const filePicker = fixture.nativeElement.querySelector('.import-file-picker') as HTMLInputElement;

      await component.importChosenFile(filePicker);

      expect(component.importReport()).toBeNull();
      expect(component.importError()).toBe('');
    });

    it('should let the same file be chosen again', async () => {
      createComponent();
      const filePicker = filePickerHolding(fileOf([contactNamed('Zoé')]));

      await component.importChosenFile(filePicker);

      expect(filePicker.files?.length).toBe(0);
    });
  });

  describe('template', () => {
    it('should say that no contact matches the search', () => {
      account.contacts = ['fanny'].map(contactNamed);
      createComponent();

      component.search.set('zoé');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.no-match').textContent).toContain(
        'Aucun contact ne correspond à « zoé ».',
      );
    });

    it('should not offer to export an empty contact list', () => {
      createComponent();

      expect(fixture.nativeElement.querySelector('.export-contacts').disabled).toBeTrue();
    });

    it('should list the imported contacts', async () => {
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé')]));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('td.mat-column-name').textContent).toContain('Zoé');
    });

    it('should sum up the import', async () => {
      account.contacts = [contactNamed('Zoé')];
      createComponent();

      await component.importContacts(fileOf(['Zoé', 'Denis', 'Emma'].map(contactNamed)));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.import-summary').textContent).toContain(
        '2 contacts ajoutés, 1 déjà présent.',
      );
    });

    it('should count the contacts already present in the plural', async () => {
      account.contacts = ['Zoé', 'Denis'].map(contactNamed);
      createComponent();

      await component.importContacts(fileOf(['Zoé', 'Denis'].map(contactNamed)));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.import-summary').textContent).toContain(
        '0 contact ajouté, 2 déjà présents.',
      );
    });

    it('should not mention refused contacts when there is none', async () => {
      createComponent();

      await component.importContacts(fileOf([contactNamed('Zoé')]));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.import-refused')).toBeNull();
    });

    it('should list each refused contact with its reason', async () => {
      createComponent();

      await component.importContacts(fileOf([{ ...contactNamed('Zoé'), pk: 'abc' }]));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.import-refused li').textContent).toContain(
        `Zoé : ${MALFORMED_PUBLIC_KEY_MESSAGE}`,
      );
    });

    it('should say why the file could not be imported', async () => {
      createComponent();

      await component.importContacts(notAContactsFile());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.import-error').textContent).toContain(
        "Ce fichier n'est pas un fichier de contacts.",
      );
    });

    it('should offer to export the contacts once there is one', () => {
      account.contacts = ['fanny'].map(contactNamed);
      createComponent();

      expect(fixture.nativeElement.querySelector('.export-contacts').disabled).toBeFalse();
    });
  });
});
