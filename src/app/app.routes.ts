import { Routes } from '@angular/router';

import { SignupPage } from './components/signup-page/signup-page';
import { ServerSelection } from './components/server-selection/server-selection';
import { RestoreAccount } from './components/restore-account/restore-account';
import { PendingValidation } from './components/pending-validation/pending-validation';
import { MainLayout } from './components/main-layout/main-layout';
import { Home } from './components/home/home';
import { AccountDetails } from './components/account-details/account-details';
import { AddContact } from './components/add-contact/add-contact';
import { CashPapers } from './components/cash-papers/cash-papers';
import { Contacts } from './components/contacts/contacts';
import { Logout } from './components/logout/logout';
import { Pay } from './components/pay/pay';
import { PayOffline } from './components/pay-offline/pay-offline';
import { ReceiveOffline } from './components/receive-offline/receive-offline';
import { PrintPapers } from './components/print-papers/print-papers';
import { TransactionList } from './components/transaction-list/transaction-list';
import { UserSelection } from './components/user-selection/user-selection';


export const routes: Routes = [
    { path: "", redirectTo: "user-selection", pathMatch: "full" },
    { path: "logout", component: Logout },
    { path: "user-selection", component: UserSelection },
    { path: "server-selection", component: ServerSelection },
    { path: "signup", component: SignupPage },
    { path: "restore-account", component: RestoreAccount },
    { path: "pending-validation", component: PendingValidation },
    // Secondary screens reached from within a tab: full-screen, back arrow, no bottom bar.
    { path: "addcontact", component: AddContact },
    { path: "cashpapers", component: CashPapers },
    { path: "printpapers", component: PrintPapers },
    { path: "pay-offline", component: PayOffline },
    { path: "receive-offline", component: ReceiveOffline },
    { path: "transactions", component: TransactionList },
    // The four permanent tabs (Phase-1.md §7) share the bottom-nav shell.
    {
        path: "", component: MainLayout, children: [
            { path: "home", component: Home },
            { path: "pay", component: Pay },
            { path: "contacts", component: Contacts },
            { path: "account", component: AccountDetails },
        ]
    },
];
