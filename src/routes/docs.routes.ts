import { Router, Request, Response } from 'express';
import path from 'path';

const router = Router();

/**
 * GET /api/docs
 * Sirve Swagger UI completo usando la CDN oficial de swagger-ui.
 * No requiere instalar swagger-ui-express.
 */
router.get('/', (_req: Request, res: Response) => {
    const swaggerUiHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Casino API — Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; background: #1a1a2e; }
    .swagger-ui .topbar { background: #16213e; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/swagger.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      persistAuthorization: true,
    });
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(swaggerUiHtml);
});

/**
 * GET /api/docs/swagger.json
 * Sirve el spec OpenAPI como JSON.
 */
router.get('/swagger.json', (_req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '..', 'docs', 'swagger.json'));
});

export default router;
