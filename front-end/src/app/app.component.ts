import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CoqueComponent } from './layout/coque/coque.component';

@Component({
  selector: 'app-root',
  imports: [CoqueComponent],
  template: '<app-coque />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
