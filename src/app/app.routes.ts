import { Routes } from '@angular/router';
import {AuthGuard} from "./_guards/auth.guard";
import {MainComponent} from "./_components/main/main.component";

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./_components/main/main.component').then((m) => m.MainComponent),
    canActivate: [AuthGuard]
  }
];
