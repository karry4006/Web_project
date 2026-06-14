<template>
  <div class="app-container">
    <!-- Section 1: Top Navigation -->
    <nav class="navbar">
      <div class="nav-brand">Faculty Specs <span class="accent-text">AI</span></div>
    </nav>

    <main class="content">
      <!-- Section 2: 智慧媒合功能區 (NLP 文字探勘) -->
      <section class="hero-section">
        <h1 class="title">探索您的研究夥伴</h1>
        <p class="subtitle">輸入您的研究興趣或專題想法，AI 將為您推薦最契合的教授。</p>
        
        <div class="search-box">
          <textarea 
            v-model="userInput" 
            placeholder="請輸入您的研究想法，例如：我想研究基於深度學習的影像處理技術..."
            class="match-input"
          ></textarea>
          <button @click="startSmartMatching" :disabled="isLoading" class="btn-cta">
            {{ isLoading ? '計算中...' : '開始智慧媒合' }}
          </button>
        </div>
      </section>

      <!-- Section 3: 動態趨勢圖表 -->
      <section class="stats-section">
        <div class="chart-header">
          <h2>技術領域熱度趨勢</h2>
          <p>基於目前所有教授的專長標籤統計</p>
        </div>
        <div class="chart-wrapper">
          <canvas id="trendChart"></canvas>
        </div>
      </section>

      <!-- Section 4: 教授卡片列表與過濾 -->
      <section class="list-section">
        <div class="list-tools">
          <div class="section-title">
            <h2>師資專長導覽</h2>
            <span class="badge" v-if="activeTag">正在篩選: #{{ activeTag }}</span>
          </div>
          <button v-if="activeTag" @click="activeTag = ''" class="btn-clear">清除過濾</button>
        </div>

        <div class="professor-grid">
          <div 
            v-for="prof in filteredProfessors" 
            :key="prof.id" 
            class="prof-card"
            :class="{ 'highlight': prof.matchScore > 70 }"
          >
            <!-- 媒合度標籤 -->
            <div v-if="prof.matchScore > 0" class="match-score">
              🔥 媒合度 {{ prof.matchScore }}%
            </div>

            <div class="prof-header">
              <h3 class="prof-name">{{ prof.name }}</h3>
              <span class="prof-id">ID: #{{ prof.id }}</span>
            </div>

            <p class="prof-description">{{ prof.description || '尚無研究描述' }}</p>

            <div class="tag-container">
              <!-- 如果有標籤，顯示標籤按鈕 -->
              <template v-if="getTagsArray(prof.tags).length > 0">
                <button 
                  v-for="tag in getTagsArray(prof.tags)" 
                  :key="tag" 
                  @click="toggleTag(tag)"
                  class="tag-pill"
                  :class="{ 'active': activeTag === tag }"
                >
                  #{{ tag }}
                </button>
              </template>
              <!-- 如果沒有標籤，顯示觸發 AI 生成的按鈕 -->
              <button 
                v-else 
                @click="triggerTagGeneration(prof.id)" 
                class="tag-pill ai-btn"
                :disabled="isGenerating === prof.id"
              >
                {{ isGenerating === prof.id ? '生成中...' : '✨ 生成 AI 標籤' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 空狀態處理 -->
        <div v-if="filteredProfessors.length === 0" class="empty-state">
          目前沒有符合條件的教授。
        </div>
      </section>
    </main>

    <footer class="footer">
      &copy; 2024 Faculty Specs AI - 專案期末專題
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';

// --- 1. 配置與初始化 ---
const API_BASE_URL = 'http://localhost:3000/api';
const professors = ref([]);
const userInput = ref('');
const activeTag = ref('');
const isLoading = ref(false);
const isGenerating = ref(null);
let chartInstance = null;

onMounted(async () => {
  await fetchProfessors();
  initChart();
});

// --- 2. API 串接邏輯 ---
/**
 * 取得教授列表 (GET)
 */
const fetchProfessors = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/professors`);
    const result = await res.json();
    if (result.message === 'success') {
      professors.value = result.data.map(p => ({ ...p, matchScore: 0 }));
    }
  } catch (err) {
    console.error('無法連線至後端 API:', err);
  } finally {
    updateChart();
  }
};

/**
 * 觸發 AI 標籤生成 (POST)
 */
const triggerTagGeneration = async (id) => {
  isGenerating.value = id;
  try {
    const res = await fetch(`${API_BASE_URL}/professors/${id}/generate-tags`, {
      method: 'POST'
    });
    const result = await res.json();
    if (result.message === 'success') {
      // 重新拉取資料以更新標籤
      await fetchProfessors();
    }
  } catch (err) {
    console.error('AI 標籤生成失敗:', err);
  } finally {
    isGenerating.value = null;
  }
};

/**
 * 防呆處理標籤字串 (處理 null 或空字串)
 */
const getTagsArray = (tags) => {
  if (!tags) return [];
  return tags.split(',').map(t => t.trim()).filter(t => t !== '');
};

// --- 3. 智慧媒合演算法 (Cosine Similarity) ---
/**
 * 開始智慧媒合：計算餘弦相似度並重新排序
 */
const startSmartMatching = () => {
  if (!userInput.value.trim()) return alert('請輸入您的研究想法！');
  
  isLoading.value = true;
  
  // 模擬短暫延遲增加互動感
  setTimeout(() => {
    professors.value = professors.value.map(prof => {
      const score = calculateCosineSimilarity(userInput.value, prof.description || '');
      return { ...prof, matchScore: Math.round(score * 100) };
    });

    // 依分數從高到低排序
    professors.value.sort((a, b) => b.matchScore - a.matchScore);
    isLoading.value = false;
  }, 600);
};

/**
 * 純 JS 實作餘弦相似度
 */
function calculateCosineSimilarity(text1, text2) {
  // 分詞：移除標點並轉為小寫字元陣列（適合中文與簡單英文）
  const tokenize = (text) => {
    return text.toLowerCase()
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '')
      .split('')
      .filter(s => s.trim() !== '');
  };

  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  const freq1 = {};
  tokens1.forEach(t => freq1[t] = (freq1[t] || 0) + 1);
  const freq2 = {};
  tokens2.forEach(t => freq2[t] = (freq2[t] || 0) + 1);

  const allKeys = new Set([...Object.keys(freq1), ...Object.keys(freq2)]);

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  allKeys.forEach(key => {
    const v1 = freq1[key] || 0;
    const v2 = freq2[key] || 0;
    dotProduct += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  });

  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// --- 4. Chart.js 趨勢圖表 ---
const initChart = () => {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const data = getStatsData();

  // 使用 window.Chart (CDN 載入)
  chartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: '技術標籤頻率',
        data: data.values,
        backgroundColor: '#2979FF',
        borderRadius: 8,
        barThickness: 24
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { precision: 0 } },
        y: { grid: { display: false } }
      }
    }
  });
};

const getStatsData = () => {
  const counts = {};
  professors.value.forEach(p => {
    getTagsArray(p.tags).forEach(tag => {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    labels: sorted.map(i => i[0]),
    values: sorted.map(i => i[1])
  };
};

const updateChart = () => {
  if (!chartInstance) return;
  const data = getStatsData();
  chartInstance.data.labels = data.labels;
  chartInstance.data.datasets[0].data = data.values;
  chartInstance.update();
};

// --- 5. 過濾機制 ---
const filteredProfessors = computed(() => {
  if (!activeTag.value) return professors.value;
  return professors.value.filter(p => getTagsArray(p.tags).includes(activeTag.value));
});

const toggleTag = (tag) => {
  if (activeTag.value === tag) {
    activeTag.value = '';
  } else {
    activeTag.value = tag;
  }
};

</script>

<style scoped>
/* 嚴格遵守 6:3:1 配色與極簡主義設計 */
.app-container {
  --bg-primary: #FFFFFF;     /* 60% 主色 */
  --bg-secondary: #F5F5F5;   /* 30% 輔助色 */
  --text-main: #111111;      /* 30% 輔助色 */
  --accent: #2979FF;         /* 10% 點綴色 (科技藍) */
  --accent-glow: #00E676;    /* 10% 點綴色 (螢光綠) */

  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-main);
  min-height: 100vh;
  padding: 0;
  margin: 0;
}

/* Navbar */
.navbar {
  padding: 1.5rem 10%;
  border-bottom: 1px solid #EEEEEE;
  display: flex;
  align-items: center;
}

.nav-brand {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -1px;
}

.accent-text {
  color: var(--accent);
}

/* Main Content */
.content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 10%;
}

/* Hero Section */
.hero-section {
  padding: 5rem 0;
}

.title {
  font-size: 3.5rem;
  font-weight: 900;
  margin: 0;
  letter-spacing: -2px;
  line-height: 1;
}

.subtitle {
  font-size: 1.25rem;
  color: #666;
  margin: 1.5rem 0 3rem 0;
  max-width: 500px;
}

.search-box {
  background: var(--bg-secondary);
  padding: 2.5rem;
  border-radius: 32px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.match-input {
  background: transparent;
  border: none;
  font-size: 1.25rem;
  font-family: inherit;
  resize: none;
  height: 120px;
  outline: none;
  color: var(--text-main);
}

.btn-cta {
  background: var(--text-main);
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 14px;
  font-weight: 700;
  font-size: 1.1rem;
  cursor: pointer;
  align-self: flex-start;
  transition: transform 0.2s;
}

.btn-cta:hover {
  transform: translateY(-2px);
  background: #333;
}

.btn-cta:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats Section */
.stats-section {
  margin: 4rem 0;
  padding: 3rem;
  background: var(--bg-secondary);
  border-radius: 32px;
}

.chart-header h2 {
  font-size: 1.8rem;
  margin: 0;
}

.chart-header p {
  color: #888;
  margin: 0.5rem 0 2rem 0;
}

.chart-wrapper {
  height: 400px;
}

/* Professor List */
.list-section {
  margin-bottom: 8rem;
}

.list-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.badge {
  background: var(--accent);
  color: white;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-clear {
  background: transparent;
  border: 1px solid #DDD;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}

.professor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 2.5rem;
}

.prof-card {
  background: white;
  border: 1px solid #F0F0F0;
  padding: 2.5rem;
  border-radius: 32px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.prof-card:hover {
  box-shadow: 0 20px 40px rgba(0,0,0,0.05);
  border-color: var(--accent);
}

.prof-card.highlight {
  border: 2px solid var(--accent-glow);
}

.match-score {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  background: var(--accent-glow);
  color: white;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 800;
  box-shadow: 0 4px 12px rgba(0, 230, 118, 0.3);
}

.prof-name {
  font-size: 1.5rem;
  font-weight: 800;
  margin: 0;
}

.prof-id {
  color: #CCC;
  font-size: 0.8rem;
}

.prof-description {
  color: #666;
  font-size: 1rem;
  line-height: 1.6;
  margin: 1.5rem 0 2rem 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.tag-pill {
  border: none;
  background: var(--bg-secondary);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-pill:hover {
  background: #E0E0E0;
}

.tag-pill.active {
  background: var(--accent);
  color: white;
}

.tag-pill.ai-btn {
  background: transparent;
  border: 1px dashed var(--accent);
  color: var(--accent);
}

.empty-state {
  text-align: center;
  padding: 5rem;
  color: #999;
  font-size: 1.2rem;
}

.footer {
  padding: 4rem 10%;
  border-top: 1px solid #F0F0F0;
  text-align: center;
  color: #AAA;
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 768px) {
  .title { font-size: 2.5rem; }
  .navbar, .content { padding: 0 5%; }
}
</style>
