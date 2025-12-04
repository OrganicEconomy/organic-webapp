import { Component } from '@angular/core';

@Component({
  selector: 'app-user-selection',
  imports: [],
  templateUrl: './user-selection.html',
  styleUrl: './user-selection.css',
})
export class UserSelection {
  users: string[] = []

  ngOnInit(): void {
    
  }
}
