import { Injectable } from '@angular/core';
import {Observable, from, BehaviorSubject, firstValueFrom} from 'rxjs';
import { map } from 'rxjs/operators';
import {
  AnalyticsApi,
  ApiClient,
  AuthData, ContentManagementApi,
  ConversationsApi,
  Models,
  RoutingApi,
  UsersApi
} from 'purecloud-platform-client-v2';
import { UrlTree, Params } from '@angular/router';
import {HttpClient} from "@angular/common/http";

// Keys for localStorage
export const CLIENTID_KEY = 'gcClientId';
export const LANG_KEY = 'gcLangTag';
export const ENV_KEY = 'gcTargetEnv';
export const CID_KEY = 'gcConversationId';
export const PARTID_KEY = 'gcParticipantId';
export const SFOID_KEY = 'sfObjectId';
export const SFSTAGE_KEY = 'sfStage';

// 2098f93d-63a3-4bbe-b936-7fd54db60e52
interface State {
  path?: string;
  params?: Params;
}

@Injectable({
  providedIn: 'root'
})
export class GenesysCloudService {

  private client = ApiClient.instance;
  private conversationsApi = new ConversationsApi();
  private analyticsApi = new AnalyticsApi();
  private usersApi = new UsersApi();
  private routingApi = new RoutingApi();
  private contentManagementApi = new ContentManagementApi();

  // Authorization values
  language: string = 'en-us';
  environment: string = 'mypurecloud.de';
  clientId: string = '';
  isAuthorized = new BehaviorSubject<boolean>(false);

  // State params (QueryParams)
  path?: string;
  qParams?: Params;

  // Other
  isFirst: boolean = true;

  constructor(private readonly http: HttpClient) {}

  isAuthenticated(): boolean {
    if (!(this.client as any)['authData'].accessToken) return false;
    // TODO: Check expiration time as well
    return true;
  }


  initialize(path?: string, qParams?: Params): Observable<boolean | UrlTree> {

    console.log("[GenesysCloudService] Initialize");

    this.initializeParams(qParams);

    this.client.setPersistSettings(true, 'demo-email-preview');
    this.client.setEnvironment(this.environment);

    var obj: State = { path: path, params: qParams };
    var state = btoa(JSON.stringify(obj));

    console.log("[GenesysCloudService] Redirect: " + window.location.origin + window.location.pathname);
    return from(this.client.loginImplicitGrant(this.clientId, window.location.origin + window.location.pathname, { state: state } )).pipe(
      map((data: AuthData) => {
        // Here only if auth succeeds
        if (data.state) {
          const actualState: State = JSON.parse(atob(data.state));
          this.path = actualState.path;
          this.qParams = actualState.params;
          this.initializeParams(qParams);
          console.log('[GenesysCloudService] State', actualState);
        }

        this.isAuthorized.next(true);
        return true;
      }));
  }

  private initializeParams(qParams?: Params) {
    if (!qParams) qParams = {};

    if (qParams[CLIENTID_KEY]) this.clientId = qParams[CLIENTID_KEY];
    if (qParams[LANG_KEY]) this.language = qParams[LANG_KEY];
    if (qParams[ENV_KEY]) this.environment = qParams[ENV_KEY];
  }

  // UsersApi

  getMe() {
    console.log(this.client.config);
    return this.usersApi.getUsersMe();
  }

  searchUsers(opts: Models.UserSearchRequest) {
    return this.usersApi.postUsersSearch(opts)
  }


  // Conversations API

  getConversation(conversationId: string) {
    return this.conversationsApi.getConversation(conversationId);
  }

  getConversationsParticipantAttributes(conversationIds: string[], cursor?: string) {
    const body: Models.ConversationParticipantSearchRequest = {
      query: [
        {
          type: "EXACT",
          fields: ["conversationId"],
          values: conversationIds
        }
      ]
    };
    if (cursor) {
      body.cursor = cursor;
    }
    return this.conversationsApi.postConversationsParticipantsAttributesSearch(body);
  }

  getConversationEmailMessage(conversationId: string, messageId: string) {
    return this.conversationsApi.getConversationsEmailMessage(conversationId, messageId);
  }

  // Analytics API

  getConversations(query: Models.ConversationQuery) {
    return this.analyticsApi.postAnalyticsConversationsDetailsQuery(query);
  }

  // Routing API

  getQueues(opts?: RoutingApi.getRoutingQueuesOptions) {
    return this.routingApi.getRoutingQueues(opts);
  }

  // Content Management API

  getDocumentWorkspaces() {
    return this.contentManagementApi.getContentmanagementWorkspaces({
      pageSize: 100
    });
  }

  async createAndUploadDocument(workspace: Models.Workspace, fileName: string, file: Blob) {

    const response = await this.contentManagementApi.postContentmanagementDocuments({
      name: fileName,
      workspace: workspace,
      tags: [],
      tagIds: []
    });

    const opts = {
      headers: {
        'Authorization': `Bearer ${(this.client as any)['authData'].accessToken}`
      }
    };
    const body = new FormData();
    body.append('file', file, response.filename);

    await firstValueFrom(this.http.post(response.uploadDestinationUri!, body, opts));
  }

}
