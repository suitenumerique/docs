import { WebsocketProvider } from 'y-websocket';

export class RelayProvider extends WebsocketProvider {
  // since the RelayProvider has been added to manage encryption that skips Hocuspocus logic
  // we mimic the needed properties for `SwitchableProvider` to be usable and to avoid use extra intermediaries
  get document() {
    return this.doc;
  }

  get configuration() {
    return {
      name: this.roomname,
    };
  }
}
