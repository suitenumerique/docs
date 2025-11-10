import { PORT } from '@/env';
import { initApp } from '@/servers';

initApp().listen(PORT, () => console.log('App listening on port :', PORT));
