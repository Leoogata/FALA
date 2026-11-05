// tests/tts.test.js — Testes unitários do serviço TTS (ElevenLabs + store em memória)
'use strict';

process.env.ELEVENLABS_API_KEY = 'el-test-key';
process.env.ELEVENLABS_VOICE_ID = 'voice-test-id';
process.env.TTS_TIMEOUT_MS = '5000';
process.env.PUBLIC_URL = 'https://test.ngrok.io';

jest.mock('axios');

const axios = require('axios');
const { textoParaAudioUrl, consumirAudio, urlMensagemFixa, preAquecer } = require('../src/services/tts');

const AUDIO_BUFFER = Buffer.from('fake-mp3-data');

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('tts.textoParaAudioUrl — fluxo feliz', () => {
  it('chama ElevenLabs com o texto e retorna URL /audio/:id', async () => {
    axios.post.mockResolvedValueOnce({ data: AUDIO_BUFFER.buffer });

    const url = await textoParaAudioUrl('Olá, esta é uma resposta educacional.');

    expect(url).toMatch(/^https:\/\/test\.ngrok\.io\/audio\/[a-f0-9]{32}$/);
    expect(axios.post.mock.calls[0][0]).toContain('elevenlabs.io');
    expect(axios.post.mock.calls[0][0]).toContain('voice-test-id');
  });

  it('envia model_id eleven_multilingual_v4 e o texto correto', async () => {
    axios.post.mockResolvedValueOnce({ data: AUDIO_BUFFER.buffer });

    await textoParaAudioUrl('Texto de teste');

    const payload = axios.post.mock.calls[0][1];
    expect(payload.model_id).toBe('eleven_multilingual_v4');
    expect(payload.text).toBe('Texto de teste');
  });

  it('o buffer fica disponível em consumirAudio pelo ID retornado', async () => {
    axios.post.mockResolvedValueOnce({ data: AUDIO_BUFFER.buffer });

    const url = await textoParaAudioUrl('Texto');
    const id = url.split('/audio/')[1];
    const buffer = consumirAudio(id);

    expect(buffer).not.toBeNull();
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('consumirAudio é one-shot — segunda chamada retorna null', async () => {
    axios.post.mockResolvedValueOnce({ data: AUDIO_BUFFER.buffer });

    const url = await textoParaAudioUrl('Texto');
    const id = url.split('/audio/')[1];

    consumirAudio(id);                    // primeira — consome
    expect(consumirAudio(id)).toBeNull(); // segunda — já não existe
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tts.textoParaAudioUrl — degradação graciosa', () => {
  it('retorna null quando ElevenLabs falha (network error)', async () => {
    axios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const url = await textoParaAudioUrl('Texto');

    expect(url).toBeNull();
  });

  it('retorna null quando PUBLIC_URL não está configurada', async () => {
    const configMod = require('../src/config');
    const original = configMod.publicUrl;
    configMod.publicUrl = '';

    const url = await textoParaAudioUrl('Texto');

    configMod.publicUrl = original;
    expect(url).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('retorna null quando ELEVENLABS_API_KEY está vazia', async () => {
    const configMod = require('../src/config');
    const original = configMod.elevenLabsApiKey;
    configMod.elevenLabsApiKey = '';

    const url = await textoParaAudioUrl('Texto');

    configMod.elevenLabsApiKey = original;
    expect(url).toBeNull();
    expect(axios.post).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('consumirAudio — IDs inexistentes', () => {
  it('retorna null para ID desconhecido', () => {
    expect(consumirAudio('id-que-nao-existe')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('tts.preAquecer — pré-aquecimento de mensagens fixas', () => {
  it('gera áudio para cada mensagem e torna urlMensagemFixa disponível', async () => {
    // Uma chamada ElevenLabs por mensagem
    axios.post
      .mockResolvedValueOnce({ data: Buffer.from('audio-boasvindas').buffer })
      .mockResolvedValueOnce({ data: Buffer.from('audio-retry').buffer });

    await preAquecer({ boasVindas: 'Olá!', sttRetry: 'Repita por favor.' });

    expect(urlMensagemFixa('boasVindas')).toMatch(/^https:\/\/test\.ngrok\.io\/audio\/boasVindas$/);
    expect(urlMensagemFixa('sttRetry')).toMatch(/^https:\/\/test\.ngrok\.io\/audio\/sttRetry$/);
  });

  it('mensagem pré-gerada pode ser lida múltiplas vezes (não é one-shot)', async () => {
    axios.post.mockResolvedValueOnce({ data: Buffer.from('audio-encerramento').buffer });

    await preAquecer({ encerramento: 'Até logo!' });

    const buf1 = consumirAudio('encerramento');
    const buf2 = consumirAudio('encerramento'); // segunda leitura — deve funcionar
    expect(buf1).not.toBeNull();
    expect(buf2).not.toBeNull(); // cache permanente, não one-shot
  });

  it('ignora silenciosamente se ElevenLabs estiver indisponível', async () => {
    const configMod = require('../src/config');
    const original = configMod.elevenLabsApiKey;
    configMod.elevenLabsApiKey = '';

    await expect(preAquecer({ boasVindas: 'Olá!' })).resolves.toBeUndefined();

    configMod.elevenLabsApiKey = original;
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('continua mesmo se uma mensagem individual falhar', async () => {
    axios.post
      .mockRejectedValueOnce(new Error('ElevenLabs 429'))   // boasVindas falha
      .mockResolvedValueOnce({ data: Buffer.from('audio-retry').buffer }); // sttRetry ok

    await expect(
      preAquecer({ boasVindas: 'Olá!', sttRetry: 'Repita.' }),
    ).resolves.toBeUndefined();

    expect(urlMensagemFixa('sttRetry')).not.toBeNull();
  });
});
