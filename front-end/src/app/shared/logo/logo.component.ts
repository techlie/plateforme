import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LOGO_TRACE, LOGO_VUE } from './logo.trace';

/** Logo SR CONSEIL : le monogramme du groupe, suivi du nom sauf en version réduite. */
@Component({
  selector: 'app-logo',
  template: `
    <svg class="logo__monogramme" [attr.viewBox]="vue" aria-hidden="true" focusable="false">
      <path [attr.d]="trace" fill="currentColor" fill-rule="evenodd" />
    </svg>
    @if (!reduit()) {
      <span class="logo__nom">SR CONSEIL</span>
    } @else {
      <span class="sr-seulement">SR CONSEIL</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--marque);
      line-height: 1;
    }
    .logo__monogramme {
      height: var(--logo-hauteur, 26px);
      width: auto;
      aspect-ratio: 912 / 684;
      flex: none;
    }
    .logo__nom {
      font-weight: 800;
      font-size: calc(var(--logo-hauteur, 26px) * 0.62);
      letter-spacing: 0.04em;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoComponent {
  /** Monogramme seul, quand la place manque. */
  readonly reduit = input(false);

  readonly vue = LOGO_VUE;
  readonly trace = LOGO_TRACE;
}
