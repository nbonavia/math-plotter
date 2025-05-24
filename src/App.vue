<template>
  <div id="app-container">
    <h1>Multi-Function Graph Plotter</h1>

    <div class="controls">
      <div class="expressions-container">
        <label class="main-label">y = f(x) =</label>
        <div v-for="(expr, index) in expressions" :key="expr.id" class="expression-input-group">
          <input
            type="text"
            :id="'expression-' + expr.id"
            v-model="expr.value"
            :placeholder="`e.g., ${index === 0 ? 'x^2' : 'sin(x)'}`"
            :style="{ borderColor: getLineColor(index) }"
          />
          <button
            @click="removeExpression(expr.id)"
            v-if="expressions.length > 1"
            class="remove-btn"
            title="Remove expression"
            aria-label="Remove expression"
          >
            ×
          </button>
        </div>
        <button @click="addExpression" class="add-btn">+ Add Equation</button>
      </div>

      <div class="parameter-controls">
        <div class="form-group">
          <label for="minX">Min X:</label>
          <input type="number" id="minX" v-model.number="minX" />
        </div>

        <div class="form-group">
          <label for="maxX">Max X:</label>
          <input type="number" id="maxX" v-model.number="maxX" />
        </div>

        <div class="form-group">
          <label for="points">Number of Points:</label>
          <input type="number" id="points" v-model.number="numPoints" min="2" max="1000" />
        </div>
      </div>

      <button @click="plotGraph" :disabled="loading" class="plot-all-btn">
        {{ loading ? 'Plotting...' : 'Plot All Graphs' }}
      </button>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>

    <div class="chart-container">
      <canvas ref="chartCanvas"></canvas>
    </div>

    <footer>
      <p>Powered by Vue.js, Chart.js, and Math.js</p>
      <p>
        Example functions: <code>x^2</code>, <code>sin(x)</code> (rad),
        <code>sind(x * pi / 180)</code> (deg), <code>cos((x * pi / 180) /2)*10</code> (deg),
        <code>log(x)</code>, <code>exp(x/5)</code>, <code>2*x+5</code>,
        <code>sin(x * pi / 180)</code> (deg)
      </p>
      <p>For <code>log(x)</code>, ensure Min X > 0.</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { create, all } from 'mathjs'
import Chart from 'chart.js/auto'

// --- State ---
let nextExprId = 1
const expressions = ref([{ id: nextExprId++, value: 'x^2' }])
const minX = ref(-10)
const maxX = ref(10)
const numPoints = ref(100)
const errorMessage = ref('')
const loading = ref(false)

const chartCanvas = ref(null)
let chartInstance = null

const math = create(all)

const lineColors = [
  'rgb(75, 192, 192)',
  'rgb(255, 99, 132)',
  'rgb(54, 162, 235)',
  'rgb(255, 206, 86)',
  'rgb(153, 102, 255)',
  'rgb(255, 159, 64)',
  'rgb(201, 203, 207)',
]

const getLineColor = (index) => lineColors[index % lineColors.length]

const addExpression = () => {
  expressions.value.push({ id: nextExprId++, value: '' })
}

const removeExpression = (idToRemove) => {
  if (expressions.value.length > 1) {
    expressions.value = expressions.value.filter((expr) => expr.id !== idToRemove)
  }
}

const plotGraph = async () => {
  if (expressions.value.every((expr) => !expr.value.trim())) {
    errorMessage.value = 'Please enter at least one mathematical expression.'
    return
  }
  if (minX.value === null || maxX.value === null || minX.value >= maxX.value) {
    errorMessage.value = 'Min X must be less than Max X, and both must be valid numbers.'
    return
  }
  if (numPoints.value < 2 || numPoints.value > 1000) {
    errorMessage.value = 'Number of points must be between 2 and 1000.'
    return
  }

  errorMessage.value = ''
  loading.value = true
  await nextTick()

  const xValues = []
  const step = (maxX.value - minX.value) / (numPoints.value - 1)
  for (let i = 0; i < numPoints.value; i++) {
    xValues.push(minX.value + i * step)
  }

  const datasets = []
  for (let i = 0; i < expressions.value.length; i++) {
    const currentExpression = expressions.value[i]
    if (!currentExpression.value.trim()) continue

    let compiledExpr
    try {
      compiledExpr = math.compile(currentExpression.value)
    } catch (e) {
      errorMessage.value = `Error parsing "${currentExpression.value}": ${e.message}`
      loading.value = false
      return
    }

    const yValues = []
    for (const x of xValues) {
      try {
        const y = compiledExpr.evaluate({ x: x })
        yValues.push(typeof y === 'number' && isFinite(y) ? y : null)
      } catch (e) {
        errorMessage.value = `Error evaluating "${currentExpression.value}" at x=${x.toFixed(2)}: ${e.message}`
        loading.value = false
        return
      }
    }
    datasets.push({
      label: `y = ${currentExpression.value}`,
      data: yValues,
      borderColor: getLineColor(i),
      tension: 0.1,
      fill: false,
      pointRadius: currentExpression.value.match(/[xX]/) ? 0 : 3,
      pointHoverRadius: 5,
    })
  }

  if (!datasets.length) {
    errorMessage.value = 'No valid expressions to plot.'
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
    loading.value = false
    return
  }

  if (chartInstance) chartInstance.destroy()
  if (chartCanvas.value) {
    const ctx = chartCanvas.value.getContext('2d')
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: { labels: xValues.map((val) => val.toFixed(2)), datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: 'X Axis' }, type: 'linear' },
          y: { title: { display: true, text: 'Y Axis' } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (c) =>
                `${c.dataset.label || ''}: (${c.parsed.x.toFixed(2)}, ${c.parsed.y.toFixed(2)})`,
            },
          },
          legend: { position: 'top' },
        },
      },
    })
  }
  loading.value = false
}

onMounted(() => {
  if (expressions.value.some((e) => e.value.trim())) plotGraph()
})
onBeforeUnmount(() => {
  if (chartInstance) chartInstance.destroy()
})
</script>

<style>
/* --- GLOBAL STYLES FOR FULL WIDTH --- */
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow-x: hidden; /* Prevent accidental horizontal scroll */
}

/* Target the div where your Vue app is mounted (usually <div id="app"> in index.html) */
#app {
  width: 100%;
  min-height: 100%;
  display: flex; /* Makes #app-container fill height if flex-grow is used */
  flex-direction: column;
}
/* --- END GLOBAL STYLES --- */

/* Base and Mobile-First Styles */
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  /* Some body styles might be redundant now due to global html,body above */
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif,
    'Apple Color Emoji', 'Segoe UI Emoji';
  background-color: #f4f7f6; /* Moved from #app-container to body */
  color: #333;
  line-height: 1.6;
  font-size: 16px;
}

#app-container {
  width: 100%; /* Ensure it takes full width */
  margin: 0; /* No horizontal auto margins */
  padding: 15px; /* Inner spacing */
  background-color: #fff; /* Background for the content area */
  flex-grow: 1; /* If #app is flex, this makes #app-container fill remaining vertical space */
  display: flex; /* Using flex for internal layout of app-container */
  flex-direction: column;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 1.5em;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 25px;
  padding: 15px;
  background-color: #eef1f0;
  border-radius: 6px;
}

.expressions-container > .main-label,
.form-group > label {
  font-weight: bold;
  font-size: 0.9em;
  color: #555;
  margin-bottom: 5px;
  display: block;
}

.expressions-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.expression-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expression-input-group input[type='text'],
.form-group input[type='text'],
.form-group input[type='number'] {
  flex-grow: 1;
  padding: 10px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1em;
  width: 100%;
  min-width: 0;
}
.expression-input-group input[type='text'] {
  border-left-width: 4px;
}

.expression-input-group input[type='text']:focus,
.form-group input[type='text']:focus,
.form-group input[type='number']:focus {
  border-color: #007bff;
  outline: 2px solid transparent;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.parameter-controls {
  display: grid;
  grid-template-columns: 1fr;
  gap: 15px;
}

.add-btn,
.remove-btn,
.plot-all-btn {
  padding: 10px 15px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1em;
  transition:
    background-color 0.2s ease,
    transform 0.1s ease;
  text-align: center;
  color: white;
}
.add-btn:active,
.remove-btn:active,
.plot-all-btn:active {
  transform: translateY(1px);
}

.add-btn {
  background-color: #28a745;
  align-self: flex-start;
}
.add-btn:hover {
  background-color: #218838;
}

.remove-btn {
  background-color: #dc3545;
  flex-shrink: 0;
  padding: 8px 12px;
  font-size: 1.2em;
  line-height: 1;
  min-width: 40px;
}
.remove-btn:hover {
  background-color: #c82333;
}

.plot-all-btn {
  background-color: #007bff;
  width: 100%;
}
.plot-all-btn:hover:not(:disabled) {
  background-color: #0056b3;
}
.plot-all-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.7;
}

.error-message {
  background-color: #f8d7da;
  color: #721c24;
  padding: 12px;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}

.chart-container {
  position: relative;
  height: 300px; /* Mobile default height */
  width: 100%;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex-shrink: 0; /* Prevent chart container from shrinking if content above is too much */
}

canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

footer {
  margin-top: auto; /* Pushes footer to bottom if #app-container is flex column and has space */
  padding-top: 20px;
  padding-bottom: 20px;
  text-align: center;
  font-size: 0.85em;
  color: #777;
  border-top: 1px solid #eee;
  width: 100%; /* Ensure footer is also full width */
  flex-shrink: 0; /* Prevent footer from shrinking */
}
footer p {
  margin: 8px 0;
}
footer code {
  background-color: #e8e8e8;
  padding: 3px 5px;
  border-radius: 3px;
  font-size: 0.95em;
  word-break: break-all;
}

/* Tablet and larger */
@media (min-width: 576px) {
  #app-container {
    padding: 20px; /* Adjust padding for larger screens if desired */
  }
  h1 {
    font-size: 1.75em;
  }
  .parameter-controls {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }
  .chart-container {
    height: 350px;
  }
}

/* Medium devices (tablets, small desktops) */
@media (min-width: 768px) {
  #app-container {
    padding: 25px;
    /* Removed max-width and auto margin to keep it full width */
    /* Removed box-shadow and border-radius as they are less common for full-width layouts */
  }
  h1 {
    font-size: 2em;
  }
  .controls {
    padding: 20px;
  }
  .chart-container {
    height: 400px;
  }
  footer {
    font-size: 0.9em;
  }
}

/* Large devices (desktops) */
@media (min-width: 992px) {
  .chart-container {
    height: 450px;
  }
}
</style>
