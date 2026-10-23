// npm run dev — starts the API (http://localhost:8080) and the mini app (http://localhost:5173) together
import { run, supervise } from './proc.mjs';

supervise([run('api', 'npm run dev -w server', 33), run('web', 'npm run dev -w web', 36)]);
