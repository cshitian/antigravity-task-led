# 🌌 Antigravity Task LED
> **当 AI 在思考，你的桌面也在“呼吸”。**  
> 一套将 Antigravity IDE 里的 AI 思考状态实时映射到桌面物理双色 LED 灯光的物联网联动系统。

---

## 📖 项目简介

**Antigravity Task LED** 是一套极客专属的桌面物理联动系统。它能够实时捕捉 Antigravity IDE（或者 VS Code）中 AI 助手的生成状态，通过轻量级 HTTP API 推送到巴法云物联网平台，进而通过 MQTT 协议广播给摆在您桌面上的 **ESP8266 物理主控芯片**，实时驱动红色与绿色 LED 切换 19 种极其炫酷的非阻塞创意灯语。

无论是沉浸式的太极双鱼呼吸，还是动感的雷达扫描、警车爆闪、医疗心电图仿真，都能让 AI 的智慧和状态在您的物理桌面上立体呈现。

---

## 🎨 核心灯语映射效果

系统原生支持多达 19 种无阻塞灯语。我们为您推荐以下三种核心状态映射方案：

| AI 状态 | 推荐灯语编号与名称 | 物理光影效果 | 极客设计理念 |
| :--- | :--- | :--- | :--- |
| 🧠 **生成中 (Generating)** | `10` **交替柔和呼吸灯** | 绿灯与红灯细腻淡入淡出、此起彼伏 | 模拟 AI 大脑正在高速运转与深度思考 |
| ✅ **生成成功 (Success)** | `16` **太极阴阳双鱼呼吸** | 绿红双灯三阶正弦 $y=\sin^3(x)$ 黏滞消长 | 阴阳相生，象征代码完美融合与收尾 |
| ❌ **生成失败/中断 (Error)**| `5` **红灯常亮** | 绿灯熄灭，红灯保持长明 | 醒目的警示红光，第一时间唤回您的注意力 |

### 📸 物理实物预览

| 🟢 绿灯点亮状态 | 💤 双灯全灭状态 |
| :---: | :---: |
| ![绿灯点亮](./2.jpg) | ![双灯全灭](./1.jpg) |

---

## 🏗️ 系统整体架构

整个系统由**软件插件**、**云端中转**和**硬件终端**三部分构成，架构极简、启动飞快：

```
┌─────────────────────────────────┐
│     Antigravity IDE / VS Code   │  ◄─── 实时监测 CDP 控制台 AI 状态
│  (antigravity-task-led 插件插件)   │
└────────────────┬────────────────┘
                 │ 
                 │ 极轻量级 HTTP POST / GET
                 ▼
┌─────────────────────────────────┐
│         巴法云物联网平台          │  ◄─── 接收 HTTP 请求，瞬间转为 MQTT 广播
│         (bemfa.com MQTT)        │
└────────────────┬────────────────┘
                 │
                 │ 实时 MQTT 订阅 (QoS 0)
                 ▼
┌─────────────────────────────────┐
│      ESP8266 物理主控硬件        │  ◄─── 搭载高精度 millis() 无阻塞有限状态机
│      [D1 绿灯]   [D2 红灯]       │       19 种特种灯语实时零卡顿流畅切换
└─────────────────────────────────┘
```

---

## 📁 目录结构说明

本仓库包含完整的硬件端固件与编辑器端插件源码：

```text
.
├── antigravity-task-led/     # Antigravity / VS Code 状态监测插件源码
│   ├── src/                  # 插件核心逻辑（CDP 监视、巴法云 HTTP 推送）
│   ├── package.json          # 插件配置文件
│   └── README.md             # 插件专属使用说明
│
├── sketch_may25a/            # ESP8266 物理主控 Arduino 固件源码
│   ├── sketch_may25a.ino     # 580+行无阻塞状态机核心代码（含19种高级灯语及WiFi/MQTT自动重连）
│   └── secrets.h.example     # 机密信息配置模板（WiFi及巴法云UID隔离）
│
└── README.md                 # 本文件（项目全局总揽说明书）
```

---

## 🔌 硬件准备与接线指南

### 1. 准备材料
* **ESP8266 开发板**（如 NodeMCU / D1 Mini） x1
* **红、绿双色 LED 灯**（或共阴极 RGB LED） x1
* **220Ω 限流电阻** x2（保护 LED，防止瞬间电流过大损坏 GPIO）
* **面包板与杜邦线** 若干

### 2. 接线对照表
本系统采用**高电平点亮**（GPIO 输出 HIGH 时亮灯，引脚安全，上电不闪烁）：

| 物理元器件 | LED 引脚属性 | 接线目标 (开发板引脚) | GPIO 编号 | 作用 |
| :--- | :--- | :--- | :--- | :--- |
| **🟢 绿灯 LED** | 阳极 (长脚) | **`D1`** (经过 220Ω 电阻) | `GPIO5` | 指示生成状态或正常在线状态 |
| **🔴 红灯 LED** | 阳极 (长脚) | **`D2`** (经过 220Ω 电阻) | `GPIO4` | 指示报错、警告或特殊锁定状态 |
| **🔌 公共负极** | 阴极 (短脚) | **`GND`** (或标有 **`G`** 的引脚) | `GND` | 电路公共零电位参考点 |

---

## 🚀 快速上手部署

### 第一步：烧录 ESP8266 硬件固件

1. 安装 **Arduino IDE** 并配置好 ESP8266 开发板环境。
2. 安装 MQTT 客户端库：在 Arduino 库管理器中搜索并安装 **`PubSubClient`**。
3. 打开目录 [sketch_may25a](./sketch_may25a)：
   * 将 `secrets.h.example` 复制一份并重命名为 `secrets.h`。
   * 打开 `secrets.h`，填入您的真实 WiFi 账号密码，以及您在 [巴法云官网](https://bemfa.com) 注册获取的唯一 **UID (私钥)**：
     ```cpp
     #define SECRET_WIFI_SSID "您的真实WiFi名称"
     #define SECRET_WIFI_PASS "您的真实WiFi密码"
     #define SECRET_BEMFA_UID "您的32位巴法云私钥UID"
     ```
   * 打开主文件 `sketch_may25a.ino`，在顶部配置区域确认您的控制主题（例如以 `002` 结尾的巴法云开关主题）：
     ```cpp
     const char* topic_control = "DveTUhQQg002"; // 您的巴法云主题名称
     ```
4. 将开发板通过 USB 接入电脑，在 Arduino IDE 中选择正确的开发板和端口，点击 **上传 (Upload)**。
5. 烧录完成后，打开串口监视器（波特率 `115200`），观察 WiFi 连接和 MQTT 订阅状态。

---

### 第二步：安装并配置编辑器端插件

1. 进入插件目录 [antigravity-task-led](./antigravity-task-led)：
   ```bash
   cd antigravity-task-led
   npm install
   npm run package  # 生成 .vsix 安装包
   ```
2. 在 Antigravity IDE / VS Code 中，打开扩展面板（`Ctrl+Shift+X`），点击右上角 `...` 菜单，选择 **“从 VSIX 安装...”**，导入刚刚生成的 `.vsix` 文件。
3. 重载窗口（`Ctrl+Shift+P` ➡️ `Developer: Reload Window`）。
4. 在 IDE 设置中，配置以下参数：
   * **巴法云 UID (Bemfa UID)**: 填入您的 32 位私钥。
   * **MQTT Topic**: 填入您的设备主题（如 `DveTUhQQg002`）。
   * **状态映射配置**：将 `Generating`、`Success`、`Error` 状态分别映射至您期望的灯语编号（例如：`10`、`16`、`5`）。

配置界面参考：

![插件配置界面](./3.png)

---

## 🛠️ 19 种丰富灯语完整速查表

您可以通过巴法云发送 `0` 至 `18` 数字指令，或发送 `i<毫秒数>` 动态指令（如 `i300`）随时调节物理灯光表现：

* `0`: **全灭 (Both Off)** —— 静默休眠
* `1`: **同闪 (Both Flash)** —— 基础同频闪烁
* `2`: **绿灯闪，红灯灭 (Green Flash)** —— 单灯提示
* `3`: **红灯闪，绿灯灭 (Red Flash)** —— 单红提示
* `4`: **绿灯常亮，红灯灭 (Green On)** —— 安全、空闲状态
* `5`: **红灯常亮，绿灯灭 (Red On)** —— 报错、警告状态
* `6`: **双灯常亮 (Both On)** —— 全亮展示
* `7`: **红绿警车交替快闪 (Police Alternate)** —— 强警示灯语
* `8`: **科技感心跳双闪 (Heartbeat Pulse)** —— 双灯模拟真实心脏律动
* `9`: **SOS 国际求救信号 (SOS Morse)** —— 三短三长三短高精度摩尔斯序列
* `10`: **交替柔和呼吸灯 (Breathing Alternate)** —— 硬件高精度 PWM 极细腻无级交替呼吸
* `11`: **双萤火虫混沌呼吸 (Firefly Sin)** —— 双通道独立非对称周期浮点正弦，模拟盛夏萤火虫起舞
* `12`: **医疗监护心电波模拟 (ECG Wave)** —— 红灯精确克隆 ECG 波形 (P波, QRS峰, T波)，绿灯脉搏同步暴闪
* `13`: **安全守护摆钟滴答 (Tick-Tock)** —— 绿灯长明，红灯每秒发出 50ms 极短脉冲“滴答”扫过
* `14`: **正余弦相位交错跑马 (Phase Chase)** —— 绿灯为正弦波，红灯为余弦波，90度完美相位差循环跑马
* `15`: **急救爆闪追击爆裂灯语 (Strobe Chase)** —— 绿灯爆闪 3 下 ➡️ 停顿 ➡️ 红灯爆闪 3 下 ➡️ 停顿
* `16`: **太极阴阳双鱼呼吸 (Tai-Chi S-curve)** —— $y = \sin^3(x)$ 三阶正弦，长端强滞留感，极致丝滑
* `17`: **"HELLO" 极客电码广播 (Hello Morse)** —— 高精度以单词 `"H-E-L-L-O"` 摩尔斯码全频段打招呼
* `18`: **科幻雷达扫描与锁定警告 (Radar Lock)** —— 3秒绿灯雷达扫描 ➡️ 1秒红灯高频暴击锁定 ➡️ 0.5秒双灯全亮锁定完成

---

## 🔒 安全合规性承诺
* **零硬编码隐私**：项目完美支持使用 `secrets.h` 进行本地凭据的物理隔离，模板已自动忽略，保证您在 GitHub 上开源时的完全安全。
* **高可靠无阻塞**：硬件端代码中**绝无**任何一处引发死循环或卡死的阻塞 `delay()` 函数，重连与任务交替采用非阻塞定时片切片驱动，可提供工业级的持久稳定运行。

---

## 🤝 鸣谢与贡献
* 本项目依托 **Antigravity IDE** 强大的 AI 开发能力构建。
* 感谢 [巴法云物联网平台 (Bemfa)](https://bemfa.com) 提供极速稳定的云端消息中转服务。

如果您觉得本项目对您的工作桌面提升了科技感，欢迎点一个 **⭐ Star**！如有任何问题或创意灯语建议，欢迎提交 Issue。

---

## 友情链接

感谢 **LinuxDo** 社区的支持！

[![LinuxDo](https://img.shields.io/badge/社区-LinuxDo-blue?style=for-the-badge)](https://linux.do/)

---

# 🌌 Antigravity Task LED (English)
> **When your AI thinks, your desktop breathes.**  
> An IoT system that maps AI agent states in Antigravity IDE to physical dual-color LED lighting on your desk in real-time.

---

## 📖 Project Overview

**Antigravity Task LED** is a geek-oriented physical desktop linkage system. It captures the real-time generation status of the AI assistant in Antigravity IDE (or VS Code), pushes it to the **Bemfa IoT cloud platform** via lightweight HTTP API, and broadcasts it through MQTT to an **ESP8266 microcontroller** on your desk—driving red and green LEDs through 19 stunning non-blocking creative lighting patterns.

From immersive Tai-Chi breathing to dynamic radar scanning, police strobe, and medical ECG simulation, your AI's state comes to life physically on your desk.

---

## 🎨 Core LED Pattern Mapping

The system natively supports 19 non-blocking LED patterns. Here are the recommended three core state mappings:

| AI State | Recommended Pattern | Visual Effect | Design Philosophy |
| :--- | :--- | :--- | :--- |
| 🧠 **Generating** | `10` **Alternating Breathing** | Green & red LEDs smoothly fade in/out, alternating | Simulates the AI brain processing and deep thinking |
| ✅ **Success** | `16` **Tai-Chi Breathing** | Dual-LED $y=\sin^3(x)$ third-order S-curve blending | Yin-Yang harmony, symbolizing perfect code completion |
| ❌ **Error** | `5` **Red Constant On** | Green off, red stays lit | Strong alert signal to grab your attention |

### 📸 Hardware Preview

| 🟢 Green LED On | 💤 Both Off |
| :---: | :---: |
| ![Green LED](./2.jpg) | ![Both Off](./1.jpg) |

---

## 🏗️ System Architecture

The system consists of three parts: **editor plugin**, **cloud relay**, and **hardware terminal**:

```
┌─────────────────────────────────┐
│  Antigravity IDE / VS Code      │  ◄─── CDP monitor for AI state
│  (antigravity-task-led plugin)  │
└────────────────┬────────────────┘
                 │
                 │ Lightweight HTTP POST / GET
                 ▼
┌─────────────────────────────────┐
│      Bemfa IoT Cloud            │  ◄─── HTTP → MQTT relay
│      (bemfa.com)                │
└────────────────┬────────────────┘
                 │
                 │ Real-time MQTT subscription (QoS 0)
                 ▼
┌─────────────────────────────────┐
│   ESP8266 Microcontroller       │  ◄─── millis()-based non-blocking FSM
│   [D1 Green]   [D2 Red]         │       19 LED patterns, zero-lag switching
└─────────────────────────────────┘
```

---

## 📁 Directory Structure

```
.
├── antigravity-task-led/     # Plugin source code (CDP monitor, Bemfa HTTP push)
│   ├── src/                  # Core logic
│   ├── package.json          # Plugin config
│   └── README.md             # Plugin-specific docs
│
├── sketch_may25a/            # ESP8266 Arduino firmware
│   ├── sketch_may25a.ino     # 580+ lines non-blocking FSM (19 patterns, WiFi/MQTT auto-reconnect)
│   └── secrets.h.example     # Credential config template (WiFi & Bemfa UID isolation)
│
└── README.md                 # This file (project overview)
```

---

## 🔌 Hardware Setup & Wiring

### 1. Materials Needed
* **ESP8266 board** (NodeMCU / D1 Mini) x1
* **Red & Green dual-color LED** (or common-cathode RGB LED) x1
* **220Ω current-limiting resistors** x2
* **Breadboard & jumper wires**

### 2. Wiring Table (Active HIGH — GPIO HIGH = LED on)

| Component | LED Pin | Connect To (Dev Board) | GPIO | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **🟢 Green LED** | Anode (long leg) | **`D1`** (via 220Ω) | `GPIO5` | Generating / online status |
| **🔴 Red LED** | Anode (long leg) | **`D2`** (via 220Ω) | `GPIO4` | Error / alert status |
| **🔌 Common Ground** | Cathode (short leg) | **`GND`** | `GND` | Circuit reference |

---

## 🚀 Quick Start

### Step 1: Flash ESP8266 Firmware

1. Install **Arduino IDE** with ESP8266 board support.
2. Install **PubSubClient** library via Arduino Library Manager.
3. Open [sketch_may25a](./sketch_may25a):
   * Copy `secrets.h.example` → `secrets.h`.
   * Edit `secrets.h` with your WiFi credentials and your Bemfa **UID** (from [bemfa.com](https://bemfa.com)):
     ```cpp
     #define SECRET_WIFI_SSID "YOUR_WIFI_SSID"
     #define SECRET_WIFI_PASS "YOUR_WIFI_PASSWORD"
     #define SECRET_BEMFA_UID "YOUR_32_BIT_BEMFA_UID"
     ```
   * Open `sketch_may25a.ino`, set your control topic (e.g. ending in `002`):
     ```cpp
     const char* topic_control = "YOUR_TOPIC002";
     ```
4. Connect the board via USB, select the correct board/port in Arduino IDE, click **Upload**.
5. Open Serial Monitor (baud `115200`) to verify WiFi & MQTT connection.

---

### Step 2: Install & Configure the Plugin

1. Go to [antigravity-task-led](./antigravity-task-led):
   ```bash
   cd antigravity-task-led
   npm install
   npm run package  # Generate .vsix
   ```
2. In Antigravity IDE / VS Code, open Extensions (`Ctrl+Shift+X`), click `...` menu, select **"Install from VSIX..."**, pick the generated `.vsix`.
3. Reload window (`Ctrl+Shift+P` → `Developer: Reload Window`).
4. In IDE settings, configure:
   * **Bemfa UID**: Your 32-bit private key.
   * **MQTT Topic**: Your device topic (e.g. `your_topic002`).
   * **State mapping**: Map `Generating`, `Success`, `Error` to desired pattern IDs (e.g. `10`, `16`, `5`).

Config UI reference:

![Plugin config](./3.png)

---

## 🛠️ Full 19-Pattern Reference

Send commands `0`–`18` via Bemfa, or `i<milliseconds>` (e.g. `i300`) for dynamic frequency control:

* `0`: **Both Off** — Silent sleep
* `1`: **Both Flash** — Basic synchronous blink
* `2`: **Green Flash, Red Off** — Single LED hint
* `3`: **Red Flash, Green Off** — Error hint
* `4`: **Green On, Red Off** — Safe/idle
* `5`: **Red On, Green Off** — Error/warning
* `6`: **Both On** — Full brightness
* `7`: **Police Alternate Flash** — Strong alert
* `8`: **Heartbeat Pulse** — Dual-LED heartbeat simulation
* `9`: **SOS Morse** — International distress signal (···---···)
* `10`: **Alternating Breathing** — High-precision PWM smooth breathing
* `11`: **Firefly Chaos** — Dual independent async sine waves
* `12`: **ECG Wave Simulation** — Red LED clones ECG waveform (P wave, QRS peak, T wave)
* `13`: **Tick-Tock Guard** — Green steady, red 50ms pulse every second
* `14`: **Phase Chase** — Green sine, red cosine, 90° phase shift
* `15`: **Strobe Chase** — 3 green strobes → pause → 3 red strobes → pause
* `16`: **Tai-Chi S-Curve** — $y = \sin^3(x)$, ultra-smooth third-order blending
* `17`: **"HELLO" Morse Broadcast** — High-precision "H-E-L-L-O" Morse code sequence
* `18`: **Radar Lock** — 3s green scan → 1s red rapid lock → 0.5s both-on lock confirmed

---

## 🔒 Security

* **Zero hardcoded credentials**: Use `secrets.h` (gitignored) for local credential isolation. Safe to open-source on GitHub.
* **Non-blocking reliability**: Hardware firmware contains zero `delay()` calls — fully event-driven with `millis()` timer slices for industrial-grade stability.

---

## 🤝 Credits & Contributing

* Built on **Antigravity IDE**'s powerful AI development capabilities.
* Thanks to **Bemfa IoT Platform** ([bemfa.com](https://bemfa.com)) for fast & stable cloud message relay.

If you find this project enhances your desktop's tech vibe, give it a **⭐ Star**! Issues and creative pattern suggestions welcome.

---

## 🔗 Links

Thanks to the **LinuxDo** community!

[![LinuxDo](https://img.shields.io/badge/Community-LinuxDo-blue?style=for-the-badge)](https://linux.do/)
