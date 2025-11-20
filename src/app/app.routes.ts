import { Routes } from '@angular/router';

import { LoginPage } from './components/login-page/login-page';
import { SignupPage } from    './components/signup-page/signup-page';
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


export const routes: Routes = [
    {path:"", redirectTo:"login", pathMatch:"full"},
    {path:"login", component:LoginPage},
    {path:"logout", component:Logout},
    {path:"signup", component:SignupPage},
    {path:"account", component:AccountDetails},
    {path:"addcontact", component:AddContact},
    {path:"cashpapers", component:CashPapers},
    {path:"cashpayment", component:CashPayment},
    {path:"contacts", component:Contacts},
    {path:"pay", component:Pay},
    {path:"printpapers", component:PrintPapers},
    {path:"transactions", component:TransactionList},
    {path:"home", component:Home},
];
