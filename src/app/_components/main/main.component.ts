import {Component, OnInit, ViewChild} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {GenesysCloudService} from "../../_services/genesys-cloud.service";
import {ButtonModule} from "primeng/button";
import {DialogModule} from "primeng/dialog";
import {CalendarModule} from "primeng/calendar";
import {AutoCompleteSelectEvent, AutoCompleteCompleteEvent, AutoCompleteModule} from "primeng/autocomplete";
import {TableModule} from "primeng/table";
import {FormsModule} from "@angular/forms";
import {Models} from "purecloud-platform-client-v2";
import {CommonModule} from "@angular/common";
import {StepperModule} from "primeng/stepper";
import {CardModule} from "primeng/card";
import {Stepper} from "primeng/stepper/stepper";
import {ExcelService} from "../../_services/excel.service";
import {DropdownModule} from "primeng/dropdown";
import {InputTextModule} from "primeng/inputtext";

interface Column {
  field: string;
  header: string;
}

interface ConversationsObj {
  aConversations: Models.AnalyticsConversation[];
  conversations: Models.Conversation[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet, CommonModule, ButtonModule, DialogModule, CalendarModule, AutoCompleteModule, TableModule,
    FormsModule, StepperModule, CardModule, DropdownModule, InputTextModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent implements OnInit {

  @ViewChild('customStepper') stepper!: Stepper;

  private readonly PAGESIZE = 25;
  private readonly DELAY = (seconds: number) => new Promise(res => setTimeout(res, seconds * 1000));

  isAuthorized: boolean = false;
  cols: Column[] = [];
  queues: Models.Queue[] = [];
  workspaces: Models.Workspace[] = [];
  selectedDateFrom: Date = new Date();
  selectedDateTo: Date = new Date();
  selectedQueues: Models.Queue[] = [];
  selectedWorkspace?: Models.Workspace;
  selectedFilename?: string;

  dateFromMin: Date = new Date();
  loading: boolean = false;
  statusMessage: string = '';
  stepperActive: number = 0;
  reportItems: any[] = [];

  constructor(
    private readonly gcSvc: GenesysCloudService,
    private readonly excelSvc: ExcelService) {}

  ngOnInit(): void {

    this.gcSvc.isAuthorized.subscribe(isAuthorized => this.isAuthorized = isAuthorized);
    // Initialize columns
    this.cols = [
      { field: 'conversationStart', header: 'Date' },
      { field: 'remote', header: 'Remote' },
      { field: 'queue', header: 'Queue' },
      { field: 'users', header: 'Users' },
      { field: 'subject', header: 'Subject' }
    ];
    // Initialize dates
    this.reset();

    this.gcSvc.getDocumentWorkspaces().then(data => {
      if (data.entities) {
        this.workspaces = data.entities;
      }
    });
  }

  onActiveStepChange(event: number) {
    // For some reason, stepperActive doesn't update on default
    this.stepperActive = event;
  }

  async goToBuildAndPreview() {
    // Initialize
    this.reportItems = [];
    // Change step
    this.stepperActive = 1;
    // Request conversations
    this.loading = true;
    this.statusMessage = 'Finding conversations...';
    const conversationsObj = await this.findConversations();
    // Build preview and prepare for export
    this.statusMessage = 'Building the preview...';
    this.reportItems = this.prepareForPreviewAndExport(conversationsObj!);

    this.loading = false;
  }

  private async findConversations() {

    // Build query
    const query: Models.ConversationQuery = {
      interval: `${this.selectedDateFrom.toISOString()}/${this.selectedDateTo.toISOString()}`,
      order: "asc",
      orderBy: "conversationStart",
      paging: { pageNumber: 1, pageSize: 50 },
      segmentFilters: [
        {
          type: 'or',
          predicates: [
            { dimension: 'mediaType', value: 'voice' }
          ]
        }
      ]
    };

    if (this.selectedQueues.length > 0) {
      let queuesFilter: Models.SegmentDetailQueryFilter = { type: 'or', predicates: [] };
      this.selectedQueues.forEach(e => {
        queuesFilter.predicates?.push({ dimension: 'queueId', value: e.id });
      });
      query.segmentFilters?.push(queuesFilter);
    }

    // Send query
    let aConversations = [];
    let aConversationQueryResult = await this.getConversationsRequest(query);
    if (!aConversationQueryResult || !aConversationQueryResult.conversations) return;
    aConversations = [...aConversationQueryResult.conversations];
    if (aConversationQueryResult.totalHits && aConversationQueryResult.totalHits > this.PAGESIZE) {
      const totalPages = Math.ceil(aConversationQueryResult.totalHits / this.PAGESIZE);
      console.log(`TotalHits: ${aConversationQueryResult.totalHits} - PageSize: ${this.PAGESIZE} - TotalPages: ${totalPages}`);
      let currentPage = 2;
      while (currentPage <= totalPages) {
        aConversationQueryResult = null;
        query.paging!.pageNumber = currentPage;
        aConversationQueryResult = await this.getConversationsRequest(query);
        if (aConversationQueryResult && aConversationQueryResult.conversations) {
          aConversations = [...aConversations, ...aConversationQueryResult.conversations];
        }
        currentPage += 1;
      }
    }

    this.statusMessage = 'Interactions found. Getting participant attributes...';

    let conversations = [];

    for (const conversation of aConversations) {
     const data = await this.getConversationRequest(conversation.conversationId!);
     if (data) {
       conversations.push(data);
     }
    }

    return { aConversations, conversations };


  }

  private prepareForPreviewAndExport(conversations: ConversationsObj) {
    const itemList: any[] = [];
    // Prepare items for preview and later excel builder
    conversations.aConversations.forEach(e => {

      let customerParticipantAttrs: { [key: string]: string; } = {};
      const found = conversations.conversations.find(f => f.id === e.conversationId);
      if (found) {
        const customerParticipant = found.participants.find(f => f.purpose === 'client' || f.purpose === 'external');
        customerParticipantAttrs = customerParticipant?.attributes ?? {};
      }

      itemList.push({
        ConversationId: e.conversationId!,
        ConversationStart: e.conversationStart!,
        ParticipantAttr1: customerParticipantAttrs['ParticipantAttr1'] ? customerParticipantAttrs['ParticipantAttr1'] : '',
        ParticipantAttr2: customerParticipantAttrs['ParticipantAttr2'] ? customerParticipantAttrs['ParticipantAttr2'] : '',
        ParticipantAttr3: customerParticipantAttrs['ParticipantAttr3'] ? customerParticipantAttrs['ParticipantAttr3'] : '',
      });
    });
    return itemList;
  }

  displayData(conversation: Models.AnalyticsConversationWithoutAttributes, columnField: string): any {

    if (!conversation.participants) return '-';

    switch(columnField) {
      case 'originatingDirection': return conversation.originatingDirection;
      case 'conversationStart': return new Date(conversation.conversationStart!).toLocaleString();
      case 'queue':
        const foundAcd = conversation.participants.filter(e => e.purpose === 'acd');
        if (foundAcd.length === 0) return '-';
        return foundAcd.map(e => e.participantName).toString();
      case 'users':
        const foundUsers = conversation.participants.filter(e => e.purpose === 'agent');
        if (foundUsers.length === 0) return '-';
        return foundUsers.map(e => e.participantName).toString();
      case 'remote':
        const externalParticipant = conversation.participants?.find(e => e.purpose === 'external' || 'customer');
        if (externalParticipant) {
          return externalParticipant.participantName;
        }
        return '';
      case 'duration': return '';
      case 'subject':
        if (!conversation.participants[0].sessions || !conversation.participants[0].sessions[0].segments) return '-';
        return conversation.participants[0].sessions[0].segments[0].subject ? conversation.participants[0].sessions[0].segments[0].subject : '-';
      default: return '';
    }

  }

  getIntervalLabel(): string {
    const dateOpts: Intl.DateTimeFormatOptions = { hour12: false, hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${this.selectedDateFrom.toLocaleString('pl-PL', dateOpts)} - ${this.selectedDateTo.toLocaleString('pl-PL', dateOpts)}`;
  }

  onQueueSearch(event: AutoCompleteCompleteEvent) {
    console.log(`(onQueueSearch) query: ${event.query}`);
    this.gcSvc.getQueues({ name: `*${event.query}*` })
      .then(d => this.queues = d.entities ? d.entities.filter(e => !this.selectedQueues.find(f => f.id === e.id)) : [])
      .catch(err => console.error(err));
  }

  onQueueSelect(event: AutoCompleteSelectEvent) {
    console.log(`(onQueueSelect)`, event);
    // Prevent duplicates
    const found = this.selectedQueues.find(e => e.id === event.value.id);
    if (!found) this.selectedQueues.push(event.value);
  }

  private async getConversationsRequest(query: Models.ConversationQuery) {
    try {
      return await this.gcSvc.getConversations(query);
    } catch(err: any) {
      console.error(err);
      if (err.status === 429) {
        await this.DELAY(60);
        return await this.gcSvc.getConversations(query);
      }
      return null;
    }
  }

  private async getConversationRequest(conversationId: string) {
    try {
      return await this.gcSvc.getConversation(conversationId);
    } catch(err: any) {
      console.error(err);
      if (err.status === 429) {
        await this.DELAY(60);
        return await this.gcSvc.getConversation(conversationId);
      }
      return null;
    }
  }

  async buildDocumentAndExport() {
    this.loading = true;
    this.statusMessage = 'Generating file...';
    this.stepperActive = 2;

    const filename = this.selectedFilename!.trim();
    const workbook = this.excelSvc.generateExcelWorkbook(this.reportItems, `${filename}.xlsx`);
    const buffer = await workbook.xlsx.writeBuffer();
    this.statusMessage = 'Uploading to workspace...';
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    try {
      await this.gcSvc.createAndUploadDocument(this.selectedWorkspace!,`${filename}.xlsx`, blob);
      this.statusMessage = 'File successfully uploaded';
      this.loading = false;
    } catch(err: any) {
      this.statusMessage = err.message;
      this.loading = false;
    }
  }

  reset() {
    this.selectedDateFrom = new Date();
    this.selectedDateTo = new Date();
    this.selectedDateFrom.setHours(0, 0, 0);
    this.dateFromMin.setDate(this.dateFromMin.getDate() -180);
    this.selectedDateTo.setDate(this.selectedDateFrom.getDate() + 1);
    this.selectedDateTo.setHours(0, 0, 0);
    this.selectedQueues = [];
    this.selectedWorkspace = undefined;
    this.selectedFilename = undefined;

    this.statusMessage = '';
    this.reportItems = [];

    this.stepperActive = 0;
  }
}
