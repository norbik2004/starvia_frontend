import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  resizeAutoExpandTextarea,
  scheduleAutoExpandTextareaLayout,
  type AutoExpandTextareaResizeOptions,
} from './resize-auto-expand-textarea';

export type AutoExpandTextareaVariant = 'field' | 'gemini' | 'gemini-chat';

@Component({
  selector: 'app-auto-expand-textarea',
  styleUrl: './auto-expand-textarea.scss',
  template: `
    <textarea
      #textarea
      [id]="id() || null"
      [class]="resolvedClass()"
      [attr.maxlength]="maxLength() ?? null"
      [placeholder]="placeholder()"
      [disabled]="isDisabled()"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-describedby]="ariaDescribedBy() || null"
      (input)="onInput($event)"
      (blur)="onBlur()"
      (keydown)="onKeydown($event)"
    ></textarea>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AutoExpandTextarea),
      multi: true,
    },
  ],
})
export class AutoExpandTextarea implements ControlValueAccessor, AfterViewInit {
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  private usesFormControl = false;

  readonly id = input<string>();
  readonly placeholder = input('');
  readonly maxLength = input<number>();
  readonly ariaLabel = input<string>();
  readonly ariaDescribedBy = input<string>();
  readonly variant = input<AutoExpandTextareaVariant>('field');
  readonly pillRadius = input<boolean | undefined>(undefined);
  readonly enterSubmits = input(false);
  readonly escapeCancels = input(false);
  readonly disabled = input(false);
  readonly boundValue = input<string | undefined>(undefined, { alias: 'value' });

  readonly valueChange = output<string>();
  readonly enter = output<void>();
  readonly escaped = output<void>();

  private readonly disabledByForm = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  protected readonly resolvedClass = computed(() => {
    const variant = this.variant();
    return `auto-expand-textarea auto-expand-textarea--${variant}`;
  });

  private currentValue = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    effect(() => {
      if (this.usesFormControl) {
        return;
      }

      const external = this.boundValue();
      if (external === undefined) {
        return;
      }

      this.applyExternalValue(external);
    });
  }

  ngAfterViewInit(): void {
    this.applyDomValue(this.currentValue);
    this.resize();
  }

  writeValue(value: string): void {
    this.usesFormControl = true;
    this.applyExternalValue(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }

  focus(options?: FocusOptions): void {
    const textarea = this.textarea()?.nativeElement;
    if (!textarea) {
      return;
    }

    textarea.focus(options);
    const end = textarea.value.length;
    textarea.setSelectionRange(end, end);
  }

  resize(value?: string): void {
    const textarea = this.textarea()?.nativeElement;
    if (!textarea) {
      return;
    }

    resizeAutoExpandTextarea(textarea, value ?? this.currentValue, this.resizeOptions());
  }

  scheduleLayout(options: { focus?: boolean } = {}): void {
    scheduleAutoExpandTextareaLayout(
      () => this.textarea()?.nativeElement,
      () => this.currentValue,
      { ...this.resizeOptions(), ...options },
    );
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    let next = input.value;
    const max = this.maxLength();

    if (max !== undefined) {
      next = next.slice(0, max);
      if (input.value !== next) {
        input.value = next;
      }
    }

    this.commitValue(next, true);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.escapeCancels()) {
      event.preventDefault();
      this.escaped.emit();
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey && this.enterSubmits()) {
      event.preventDefault();
      this.enter.emit();
    }
  }

  private applyExternalValue(value: string): void {
    if (value === this.currentValue) {
      return;
    }

    this.commitValue(value, false);
  }

  private commitValue(value: string, emit: boolean): void {
    this.currentValue = value;
    this.applyDomValue(value);
    this.resize(value);

    if (emit) {
      this.onChange(value);
      this.onTouched();
      this.valueChange.emit(value);
    }
  }

  private applyDomValue(value: string): void {
    const textarea = this.textarea()?.nativeElement;
    if (!textarea || textarea.value === value) {
      return;
    }

    textarea.value = value;
  }

  private resizeOptions(): AutoExpandTextareaResizeOptions {
    const explicit = this.pillRadius();
    const pillRadius =
      explicit ?? (this.variant() === 'gemini' || this.variant() === 'gemini-chat');

    return { pillRadius };
  }
}
