import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // Le thème choisi s'applique aussi aux écrans de connexion, hors du cadre principal.
  private readonly theme = inject(ThemeService);
}
