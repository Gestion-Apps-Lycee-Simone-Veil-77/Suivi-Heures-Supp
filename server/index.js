import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { router } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');

const app = express();
app.use(express.json());

app.use('/api', router);

// Sert le frontend compilé (client/dist, généré par "npm run build" dans client/).
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

app.listen(config.port, () => {
  console.log(`Suivi Heures Supp — serveur démarré sur http://localhost:${config.port}`);
});
