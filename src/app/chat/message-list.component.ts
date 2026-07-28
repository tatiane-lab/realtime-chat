import {
  Component,
  Input,
  AfterViewChecked,
  ViewChild,
  ElementRef,
  signal,
} from '@angular/core';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe } from '@angular/common';
import { Message } from './chat.store';

@Component({
  selector: 'app-message-list',
  standalone: true,
  imports: [ScrollingModule, DatePipe],
  template: `
    <cdk-virtual-scroll-viewport
      #viewport
      itemSize="72"
      class="message-viewport"
      [style.height.px]="viewportHeight"
    >
      <div *cdkVirtualFor="let msg of messages; trackBy: trackById" class="message-row">
        <div class="message" [class]="'message--' + msg.status" [class.message--own]="msg.userId === currentUserId">
          <span class="avatar">{{ msg.username[0] }}</span>
          <div class="message-body">
            <span class="message-username">{{ msg.username }}</span>
            <p class="message-text">{{ msg.text }}</p>
            <time class="message-time" [attr.datetime]="msg.timestamp">
              {{ msg.timestamp | date: 'HH:mm' }}
            </time>
            @if (msg.status === 'failed') {
              <button class="retry-btn" (click)="retry.emit(msg)">Retry</button>
            }
          </div>
        </div>
      </div>
    </cdk-virtual-scroll-viewport>
  `,
})
export class MessageListComponent implements AfterViewChecked {
  @Input({ required: true }) messages: Message[] = [];
  @Input({ required: true }) currentUserId = '';
  @Input() viewportHeight = 600;

  @ViewChild('viewport') viewport!: CdkVirtualScrollViewport;

  private shouldScrollToBottom = true;

  trackById(_: number, msg: Message) {
    return msg.id;
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.viewport?.scrollToIndex(this.messages.length - 1, 'smooth');
    }
  }

  onScroll() {
    if (!this.viewport) return;
    const end = this.viewport.measureScrollOffset('end');
    this.shouldScrollToBottom = end < 100;
  }
}
