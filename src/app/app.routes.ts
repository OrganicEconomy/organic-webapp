import { Routes } from '@angular/router';

import { SignupPage } from './components/signup-page/signup-page';
import { ServerSelection } from './components/server-selection/server-selection';
import { RestoreAccount } from './components/restore-account/restore-account';
import { MainLayout } from './components/main-layout/main-layout';
import { Home } from './components/home/home';
import { AccountDetails } from './components/account-details/account-details';
import { AddContact } from './components/add-contact/add-contact';
import { CashPapers } from './components/cash-papers/cash-papers';
import { CashPayment } from './components/cash-payment/cash-payment';
import { Contacts } from './components/contacts/contacts';
import { Logout } from './components/logout/logout';
import { Pay } from './components/pay/pay';
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
    // Secondary screens reached from within a tab: full-screen, back arrow, no bottom bar.
    { path: "addcontact", component: AddContact },
    { path: "cashpapers", component: CashPapers },
    { path: "cashpayment", component: CashPayment },
    { path: "printpapers", component: PrintPapers },
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
