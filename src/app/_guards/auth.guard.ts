import { Injectable } from "@angular/core";
import { Location } from "@angular/common";
import { GenesysCloudService } from "../_services/genesys-cloud.service";
import { ActivatedRouteSnapshot } from "@angular/router";

@Injectable({
  providedIn: 'root'
})
export class AuthGuard {
    constructor(private readonly gcSvc: GenesysCloudService, private location: Location) {}

    canActivate(route: ActivatedRouteSnapshot) {
        if (!this.gcSvc.isAuthenticated()) {
            console.log('[AuthGuard] Not Authenticated');
            return this.gcSvc.initialize(this.location.path(), route.queryParams);
        }
        console.log('[AuthGuard] Authenticated');
        return true;
    }

}
