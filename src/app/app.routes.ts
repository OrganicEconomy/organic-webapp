import { Routes } from '@angular/router';

import { SignupPage } from './components/signup-page/signup-page';
import { ServerSelection } from './components/server-selection/server-selection';
import { RestoreAccount } from './components/restore-account/restore-account';
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
    { path: "account", component: AccountDetails },
    { path: "addcontact", component: AddContact },
    { path: "cashpapers", component: CashPapers },
    { path: "cashpayment", component: CashPayment },
    { path: "contacts", component: Contacts },
    { path: "pay", component: Pay },
    { path: "printpapers", component: PrintPapers },
    { path: "transactions", component: TransactionList },
    { path: "home", component: Home },
];
