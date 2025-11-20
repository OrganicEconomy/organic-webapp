import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-contacts',
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './contacts.html',
  styleUrl: './contacts.css',
})
export class Contacts {
  displayedColumns: string[] = ['name', 'pk']
  dataSource = [
    {
      name: "Michelle",
      pk: "02c85e4e448d67a8dc724c620f3fe7d2a3a3cce9fe905b918f712396b4f8effcb3"
    }
  ]
}
