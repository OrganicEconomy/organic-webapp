import { Component } from '@angular/core';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  /**
   * 1. Get cookies to see who user is.
   * If no user is set, redirect to user choice.
   */

  /**
   * 2. Get Local Database user informations to update the amount of
   * available money, the level and the amount needed for next level.
   */

}
