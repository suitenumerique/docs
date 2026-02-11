import { WebsocketProvider } from 'y-websocket';

export class RelayProvider extends WebsocketProvider {
  // since the RelayProvider has been added to manage encryption that skip Hocuspocus logic
  // and to avoid complexifying extra interfaces we mimic the needed properties for `SwitchableProvider` to be usable
  get document() {
    return this.doc;
  }
}
