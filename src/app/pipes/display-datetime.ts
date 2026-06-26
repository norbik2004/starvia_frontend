import { formatDate } from '@angular/common';
import { LOCALE_ID, Pipe, PipeTransform, inject } from '@angular/core';

@Pipe({
  name: 'displayDatetime',
})
export class DisplayDatetimePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: Date | string | number | null | undefined): string | null {
    if (value == null || value === '') {
      return null;
    }

    try {
      const date = formatDate(value, 'mediumDate', this.locale);
      const time = formatDate(value, 'shortTime', this.locale);
      return `${date}, ${time}`;
    } catch {
      return null;
    }
  }
}
