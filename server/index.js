import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { all, get, initializeDatabase, run } from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
}));
app.use(express.json());

await initializeDatabase();

app.get('/api/health', (req, res) => {
  res.json({ message: 'success', data: { status: 'ok' } });
});

app.get('/api/professors', async (req, res) => {
  try {
    const professors = await all(`
      SELECT id, name, department, description, tags
      FROM professors
      ORDER BY id ASC
    `);

    res.json({ message: 'success', data: professors });
  } catch (error) {
    console.error('Failed to fetch professors:', error);
    res.status(500).json({ message: 'error', error: '讀取教授資料失敗' });
  }
});

app.post('/api/professors/:id/generate-tags', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      res.status(400).json({ message: 'error', error: '教授 ID 格式錯誤' });
      return;
    }

    const professor = await get(`
      SELECT id, name, department, description, tags
      FROM professors
      WHERE id = ?
    `, [id]);

    if (!professor) {
      res.status(404).json({ message: 'error', error: '找不到教授資料' });
      return;
    }

    const tags = await generateTags(professor);

    await run(`
      UPDATE professors
      SET tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [tags.join(','), id]);

    res.json({
      message: 'success',
      data: {
        id,
        tags: tags.join(','),
      },
    });
  } catch (error) {
    console.error('Failed to generate tags:', error);
    res.status(500).json({ message: 'error', error: '產生 AI 標籤失敗' });
  }
});

async function generateTags(professor) {
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('請把')) {
    return generateTagsWithGemini(professor);
  }

  return generateFallbackTags(professor.description || '');
}

async function generateTagsWithGemini(professor) {
  const prompt = `
請根據以下教授研究專長，產生 3 到 6 個繁體中文技術標籤。
請只回傳 JSON 陣列，不要加解釋文字。例如：["人工智慧","資料探勘","網路安全"]

教授姓名：${professor.name}
系所：${professor.department || '未提供'}
研究描述：${professor.description || '未提供'}
`;

  const errors = [];

  for (const model of getGeminiModelsToTry()) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        errors.push(`${model}: ${response.status} ${text}`);
        continue;
      }

      const result = await response.json();
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const tags = parseGeminiTags(text);

      if (tags.length > 0) {
        return tags;
      }
    } catch (error) {
      errors.push(`${model}: ${error.message}`);
    }
  }

  console.warn('Gemini models failed. Falling back to local tags:', errors.join(' | '));
  return generateFallbackTags(professor.description || '');
}

function getGeminiModelsToTry() {
  return [...new Set([
    process.env.GEMINI_MODEL,
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-lite',
  ].filter(Boolean))];
}

function parseGeminiTags(text) {
  try {
    const jsonText = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) return [];

    return normalizeTags(parsed);
  } catch {
    return normalizeTags(text.split(/[,，、\n]/));
  }
}

function generateFallbackTags(description) {
  const lowerText = description.toLowerCase();
  const keywordMap = [
    ['人工智慧', ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network', '智慧', '學習']],
    ['資料科學', ['data', 'database', '資料', '探勘', 'big data']],
    ['網路通訊', ['network', 'wireless', '5g', '6g', 'communication', '通訊', '網路']],
    ['資訊安全', ['security', 'cryptography', 'privacy', '安全', '加密']],
    ['半導體', ['semiconductor', 'microelectronics', 'nanoelectronics', 'vlsi', 'ic', '晶片', '積體電路']],
    ['嵌入式系統', ['embedded', 'iot', 'sensor', 'rfid', '物聯網', '感測器']],
    ['軟體工程', ['software', 'system', 'architecture', '軟體', '系統']],
    ['影像處理', ['image', 'vision', 'computer vision', '影像', '視覺']],
    ['生醫工程', ['biomedical', 'bio', 'medical', 'health', '生醫', '醫療']],
    ['電路設計', ['circuit', 'analog', 'mixed-signal', 'rf', '電路']],
  ];

  const tags = keywordMap
    .filter(([, keywords]) => keywords.some((keyword) => lowerText.includes(keyword.toLowerCase())))
    .map(([tag]) => tag);

  return tags.length > 0 ? tags.slice(0, 6) : ['研究專長', '工程應用', '專題指導'];
}

function normalizeTags(tags) {
  return [...new Set(tags
    .map((tag) => String(tag).replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 6))];
}

app.listen(PORT, () => {
  console.log(`Faculty Specs AI server is running at http://localhost:${PORT}`);
});
