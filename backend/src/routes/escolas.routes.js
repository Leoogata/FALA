import { Router } from 'express';
import { campanhasController } from '../controllers/campanhas.controller.js';

const router = Router();

/**
 * @openapi
 * /escolas/{codigo}:
 *   get:
 *     tags: [Escolas]
 *     summary: Resolve o código de uma escola (digitado no teclado pelo aluno)
 *     description: >
 *       Consumido pela URA (telephony-handler) quando o aluno digita o código
 *       da escola. Retorna os dados da escola para que o fluxo filtre as
 *       campanhas por ela. Responde 404 se o código não existir.
 *     parameters:
 *       - in: path
 *         name: codigo
 *         required: true
 *         schema:
 *           type: string
 *         description: Código numérico da escola (ex. 1234)
 *     responses:
 *       200:
 *         description: Escola encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 codigo: { type: string }
 *                 nome: { type: string }
 *       404:
 *         description: Escola não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
router.get('/:codigo', campanhasController.buscarEscolaPorCodigo);

export default router;
