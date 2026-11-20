import { Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-help-panel',
  imports: [MatExpansionModule],
  templateUrl: './help-panel.html',
  styleUrl: './help-panel.css',
})
export class HelpPanel {}
