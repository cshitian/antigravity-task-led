#include <ESP8266WiFi.h>
#include <PubSubClient.h>

// ==========================================
// 📌 用户配置区域：巴法云平台配置
// ==========================================
const char* wifi_ssid = "YOUR_WIFI_SSID";         // 您的 WiFi 名称
const char* wifi_password = "YOUR_WIFI_PASSWORD"; // 您的 WiFi 密码

// 巴法云 MQTT 接入配置
const char* mqtt_broker = "mqtt.bemfa.com";                     // 巴法云服务器地址
const int mqtt_port = 9501;                                     // 巴法云普通端口
const char* mqtt_client_id = "YOUR_BEMFA_UID"; // 您的巴法云私钥 (UID)

// 巴法云主题定义 (002后缀代表插座/开关设备类型)
const char* topic_control = "YOUR_BEMFA_TOPIC002";     // 订阅控制主题 (您的巴法云主题名称)
const char* topic_status = "YOUR_BEMFA_TOPIC002/up";    // 状态上报主题 (用于非推送式状态更新)

// ==========================================
// 📌 硬件与引脚定义
// ==========================================
const int ledGreen = D1; // 绿灯 (对应 GPIO5)
const int ledRed = D2;   // 红灯 (对应 GPIO4)

// ==========================================
// 📌 状态机与工作模式定义
// ==========================================
enum LedMode {
  MODE_BOTH_OFF = 0,    // 0: 全灭
  MODE_BOTH_FLASH,      // 1: 同闪
  MODE_GREEN_FLASH,     // 2: 绿灯闪，红灯灭
  MODE_RED_FLASH,       // 3: 红灯闪，绿灯灭
  MODE_GREEN_ON,        // 4: 绿灯常亮，红灯灭
  MODE_RED_ON,          // 5: 红灯常亮，绿灯灭
  MODE_BOTH_ON,         // 6: 双灯常亮
  MODE_POLICE_ALT,      // 7: 警车交替快闪 (警示灯语)
  MODE_HEARTBEAT,       // 8: 科技感双灯心跳双闪 (心跳灯语)
  MODE_SOS,             // 9: SOS 国际求救灯语 (三短三长三短)
  MODE_BREATHING,       // 10: 红绿交替柔和呼吸灯 (交替无级调光)
  MODE_FIREFLY,         // 11: 夏夜双萤火虫自然混沌呼吸 (非对称双频正弦)
  MODE_ECG,             // 12: 医疗监护仪心电波模拟 (红灯ECG，绿灯血氧同步)
  MODE_TICKTOCK,        // 13: 安全防护摆钟滴答计时 (绿常亮，红灯秒级短脉冲)
  MODE_PHASE_CHASE,     // 14: 正余弦跑马旋转霓虹灯 (90度相位差交错变光)
  MODE_STROBE_CHASE,    // 15: 特种爆闪追击爆裂灯语 (绿3爆闪 -> 停顿 -> 红3爆闪)
  MODE_TAICHI,          // 16: 太极阴阳双鱼呼吸 (三阶正弦S形柔滑转换)
  MODE_HELLO_MORSE,     // 17: 极客问候语 "HELLO" 摩尔斯广播 (单词高精度序列电码)
  MODE_RADAR            // 18: 科幻雷达扫描与锁定警告 (绿灯缓慢扫描，红灯突发锁定)
};

// 当前运行模式（加 volatile 防止编译器过度优化，上电默认同闪）
volatile LedMode currentMode = MODE_BOTH_FLASH;

// 无阻塞定时器参数 (非 const，允许动态修改闪烁速度)
unsigned long prevFlashMillis = 0;
volatile unsigned long flashInterval = 500; // 闪烁默认时间间隔：500毫秒
bool flashToggle = false;

// 🌟 新增：高级灯语与呼吸控制私有状态变量
unsigned long prevHeartbeatMillis = 0;
int heartbeatStep = 0;
const int heartbeatPattern[] = { 80, 100, 80, 600 }; // 亮、灭、亮、灭大停顿

unsigned long prevSosMillis = 0;
int sosStep = 0;
const int sosPattern[] = {
  200, 200, 200, 200, 200, 200, // S (亮200/灭200，3次)
  400,                          // S和O的间隔 (灭400)
  600, 200, 600, 200, 600, 200, // O (亮600/灭200，3次)
  400,                          // O和S的间隔 (灭400)
  200, 200, 200, 200, 200, 1000 // S (亮200/灭200，3次，最后一次大停顿1秒)
};
const int sosTotalSteps = 20;

unsigned long prevBreathMillis = 0;
int breathVal = 0;
int breathDir = 4; // 呼吸步长

// 🌟 新增：摩尔斯 "HELLO" 专属控制状态与高精度序列
unsigned long prevHelloMillis = 0;
int helloStep = 0;
const int helloPattern[] = {
  200, 200, 200, 200, 200, 200, 200, 600, // H (短短短短) + 字母间隔 600ms
  200, 600,                               // E (短) + 字母间隔 600ms
  200, 200, 600, 200, 200, 200, 200, 600, // L (短长短短) + 字母间隔 600ms
  200, 200, 600, 200, 200, 200, 200, 600, // L (短长短短) + 字母间隔 600ms
  600, 200, 600, 200, 600, 2000           // O (长长长) + 单词循环大间隔 2s
};
const int helloTotalSteps = 30; // 整个 "HELLO" 共 30 步

// 非阻塞 MQTT 重连定时器
unsigned long lastReconnectAttempt = 0;
const unsigned long reconnectInterval = 5000; // 每 5 秒尝试重连一次，不卡死主循环

// ==========================================
// 📌 实例化网络服务对象
// ==========================================
WiFiClient espClient;
PubSubClient client(espClient);

// ==========================================
// 📌 函数声明
// ==========================================
void setupWiFi();
void callback(char* topic, byte* payload, unsigned int length);
bool connectMQTT();
void handleLedState();
void reportStatus();

// ==========================================
// 📌 初始化设置
// ==========================================
void setup() {
  // 1. 初始化串口通信
  Serial.begin(115200);
  delay(10);
  Serial.println("\n\n=== ESP8266 双 LED MQTT 控制系统启动 ===");

  // 2. 初始化 LED 引脚模式
  pinMode(ledGreen, OUTPUT);
  pinMode(ledRed, OUTPUT);
  
  // 默认初始为全灭状态
  digitalWrite(ledGreen, LOW);
  digitalWrite(ledRed, LOW);

  // 3. 连接 WiFi
  setupWiFi();

  // 4. 配置 MQTT 服务器及回调函数
  client.setServer(mqtt_broker, mqtt_port);
  client.setCallback(callback);
}

// ==========================================
// 📌 主程序循环
// ==========================================
void loop() {
  // 1. 自动维护 WiFi 状态 (ESP8266 SDK 后台会自动进行断线自动重连)
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiCheck = 0;
    static unsigned long disconnectStart = 0;
    
    // 记录开始断开的初始时刻
    if (disconnectStart == 0) {
      disconnectStart = millis();
    }
    
    // 每 10 秒在串口打印一次离线警告，但此时本地 LED 状态机依然在流畅地工作，不会产生任何卡顿
    if (millis() - lastWifiCheck > 10000) {
      Serial.println("[WARNING] WiFi disconnected. Running offline... Background auto-reconnecting...");
      lastWifiCheck = millis();
    }
    
    // 🌟 工业级双重保障：若断开持续超过 60 秒底层仍未重连成功 (可能信道拥堵或硬件状态异常)
    // 则在后台主动执行一次 WiFi.reconnect() 强制复位网卡重连，避免偶发性死锁
    if (millis() - disconnectStart > 60000) {
      Serial.println("[SYSTEM] WiFi disconnect lasted > 60s. Force triggering WiFi.reconnect()...");
      WiFi.reconnect(); 
      disconnectStart = millis(); // 重置计时，防止频繁强连
    }
  } else {
    // 状态恢复正常，重置断开时刻计时
    static unsigned long disconnectStart = 0;
    disconnectStart = 0;
  }

  // 2. 非阻塞维护 MQTT 连接
  if (!client.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > reconnectInterval) {
      lastReconnectAttempt = now;
      Serial.println("[MQTT] Attempting to connect to broker...");
      if (connectMQTT()) {
        lastReconnectAttempt = 0; // 重置重连计时
      }
    }
  } else {
    // 保持 MQTT 心跳与处理消息接收
    client.loop();
  }

  // 3. 执行无阻塞 LED 状态机逻辑
  handleLedState();
}

// ==========================================
// 📌 连接 WiFi 函数
// ==========================================
void setupWiFi() {
  delay(10);
  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(wifi_ssid);

  // 设置为工作站模式并开始连接
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid, wifi_password);

  // 阻塞式连接：仅在开机初始化时等待 WiFi 连接，以确保获取 IP 地址
  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED && retryCount < 30) {
    delay(500);
    Serial.print(".");
    // 闪烁绿灯作为正在连接 WiFi 的视觉提示
    digitalWrite(ledGreen, !digitalRead(ledGreen));
    retryCount++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(ledGreen, LOW); // 连接成功，恢复常灭状态
    Serial.println("\n[WiFi] WiFi Connected successfully!");
    Serial.print("[WiFi] IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] WiFi connection timeout! Will retry in background.");
  }
}

// ==========================================
// 📌 MQTT 消息回调函数 (处理接收到的控制命令)
// ==========================================
void callback(char* topic, byte* payload, unsigned int length) {
  // 1. 转换负载数据为 C 风格字符串
  char message[32] = {0};
  for (unsigned int i = 0; i < length && i < 31; i++) {
    message[i] = (char)payload[i];
  }

  // 2. 清洗数据：移除可能存在的尾部空白字符、回车（\r）或换行（\n）
  int len = strlen(message);
  while (len > 0 && (message[len - 1] == ' ' || message[len - 1] == '\r' || message[len - 1] == '\n')) {
    message[len - 1] = '\0';
    len--;
  }

  Serial.print("[MQTT] Message arrived on topic [");
  Serial.print(topic);
  Serial.print("] Payload: \"");
  Serial.print(message);
  Serial.println("\"");

  // 3. 检查是否为控制主题
  if (strcmp(topic, topic_control) == 0) {
    // A. 动态时间调整分支：如果收到的是以 'i' 或 'I' 开头的指令 (如 i200)
    if (message[0] == 'i' || message[0] == 'I') {
      long customInterval = atol(message + 1); // 提取 'i' 之后的数值
      if (customInterval >= 30 && customInterval <= 10000) { // 限制在 30ms 至 10s 内以防系统异常
        flashInterval = customInterval;
        Serial.print("[SYSTEM] Custom flash interval updated to: ");
        Serial.print(flashInterval);
        Serial.println(" ms");

        // 反馈更新时间
        if (client.connected()) {
          char tempMsg[32];
          sprintf(tempMsg, "interval:%ld", flashInterval);
          client.publish(topic_status, tempMsg);
        }
      } else {
        Serial.println("[ERROR] Interval value out of range (30ms - 10000ms).");
      }
      return; // 改完时间直接返回，不改变当前灯光的工作模式
    }

    int cmd = -1;
    
    // B. 兼容巴法云的智能音箱、微信小程序常用 "on" / "off" 开关指令
    if (strcmp(message, "on") == 0) {
      cmd = (int)MODE_BOTH_ON; // 收到 "on" 默认开启双灯常亮 (模式6)
    } else if (strcmp(message, "off") == 0) {
      cmd = (int)MODE_BOTH_OFF; // 收到 "off" 关闭所有灯 (模式0)
    } else {
      // 否则解析为 0~18 数字指令
      cmd = atoi(message);
      // 安全容错：如果非数字且不是 "0"，atoi 会返回 0，这会导致误判定为 0。这里进行过滤。
      if (cmd == 0 && strcmp(message, "0") != 0) {
        cmd = -1;
      }
    }
    
    // 4. 安全验证与状态切换
    if (cmd >= 0 && cmd <= 18) {
      currentMode = (LedMode)cmd;
      Serial.print("[SYSTEM] Command parsed. Switched mode to: ");
      Serial.println(cmd);
      
      // 切换模式时，主动复位灯语和呼吸的私有状态，保证新模式立马从第一步播放
      heartbeatStep = 0;
      sosStep = 0;
      helloStep = 0;
      breathVal = 0;
      
      // 物联网状态反馈闭环 (向巴法云同步)
      reportStatus();
    } else {
      Serial.print("[ERROR] Invalid command: \"");
      Serial.print(message);
      Serial.println("\". (Allowed: \"on\", \"off\", digits 0-18, or \"i<ms>\" to change interval)");
    }
  }
}

// ==========================================
// 📌 非阻塞 MQTT 连接尝试函数
// ==========================================
bool connectMQTT() {
  // 尝试连接 MQTT 代理
  if (client.connect(mqtt_client_id)) {
    Serial.println("[MQTT] Connected to Broker!");
    
    // 连接成功后订阅控制主题
    client.subscribe(topic_control);
    Serial.print("[MQTT] Subscribed to: ");
    Serial.println(topic_control);
    
    // 上报当前初始状态
    reportStatus();
    return true;
  } else {
    Serial.print("[MQTT] Failed to connect, rc=");
    Serial.print(client.state());
    Serial.println(". Will try again in 5s.");
    return false;
  }
}

// ==========================================
// 📌 无阻塞 LED 有限状态机控制核心
// ==========================================
void handleLedState() {
  unsigned long currentMillis = millis();

  // 1. 独立维护一个非阻塞的翻转信号，供所有“标准闪烁”模式复用
  if (currentMillis - prevFlashMillis >= flashInterval) {
    prevFlashMillis = currentMillis;
    flashToggle = !flashToggle;
  }

  // 2. 根据当前模式，决定硬件引脚电平输出
  switch (currentMode) {
    case MODE_BOTH_OFF: // 0: 全灭
      digitalWrite(ledGreen, LOW);
      digitalWrite(ledRed, LOW);
      break;

    case MODE_BOTH_FLASH: // 1: 同闪
      digitalWrite(ledGreen, flashToggle ? HIGH : LOW);
      digitalWrite(ledRed, flashToggle ? HIGH : LOW);
      break;

    case MODE_GREEN_FLASH: // 2: 绿灯闪，红灯灭
      digitalWrite(ledGreen, flashToggle ? HIGH : LOW);
      digitalWrite(ledRed, LOW);
      break;

    case MODE_RED_FLASH: // 3: 红灯闪，绿灯灭
      digitalWrite(ledGreen, LOW);
      digitalWrite(ledRed, flashToggle ? HIGH : LOW);
      break;

    case MODE_GREEN_ON: // 4: 绿灯常亮，红灯灭
      digitalWrite(ledGreen, HIGH);
      digitalWrite(ledRed, LOW);
      break;

    case MODE_RED_ON: // 5: 红灯常亮，绿灯灭
      digitalWrite(ledGreen, LOW);
      digitalWrite(ledRed, HIGH);
      break;

    case MODE_BOTH_ON: // 6: 双灯常亮
      digitalWrite(ledGreen, HIGH);
      digitalWrite(ledRed, HIGH);
      break;

    case MODE_POLICE_ALT: // 7: 警车交替快闪 (利用当前间隔时间的 1/2 进行高速交替闪烁)
      digitalWrite(ledGreen, flashToggle ? HIGH : LOW);
      digitalWrite(ledRed, flashToggle ? LOW : HIGH);
      break;

    case MODE_HEARTBEAT: { // 8: 科技感双灯心跳双闪 (模仿人类心脏脉动)
      if (currentMillis - prevHeartbeatMillis >= heartbeatPattern[heartbeatStep]) {
        prevHeartbeatMillis = currentMillis;
        heartbeatStep = (heartbeatStep + 1) % 4;
      }
      bool heartbeatState = (heartbeatStep == 0 || heartbeatStep == 2);
      digitalWrite(ledGreen, heartbeatState ? HIGH : LOW);
      digitalWrite(ledRed, heartbeatState ? HIGH : LOW);
      break;
    }

    case MODE_SOS: { // 9: SOS 国际求救灯语 (严格按照三短三长三短摩尔斯电码广播)
      if (currentMillis - prevSosMillis >= sosPattern[sosStep]) {
        prevSosMillis = currentMillis;
        sosStep = (sosStep + 1) % sosTotalSteps;
      }
      // 提取亮灭序列中的亮灯步骤 (偶数位置及大间隔区分)
      bool isLight = false;
      if (sosStep == 0 || sosStep == 2 || sosStep == 4) isLight = true;       // S (短短短)
      else if (sosStep == 8 || sosStep == 10 || sosStep == 12) isLight = true; // O (长长长)
      else if (sosStep == 14 || sosStep == 16 || sosStep == 18) isLight = true;// S (短短短)

      digitalWrite(ledGreen, isLight ? HIGH : LOW);
      digitalWrite(ledRed, isLight ? HIGH : LOW);
      break;
    }

    case MODE_BREATHING: { // 10: 红绿交替柔和呼吸灯 (使用 ESP8266 硬件高精度 PWM 模拟淡入淡出)
      if (currentMillis - prevBreathMillis >= 8) { // 8ms 微调，呼吸曲线极其细腻
        prevBreathMillis = currentMillis;
        breathVal += breathDir;
        if (breathVal >= 1023) {
          breathVal = 1023;
          breathDir = -4; // 转向淡出
        } else if (breathVal <= 0) {
          breathVal = 0;
          breathDir = 4;  // 转向淡入
        }
      }
      analogWrite(ledGreen, breathVal);
      analogWrite(ledGreen, breathVal);
      analogWrite(ledRed, 1023 - breathVal); // 红绿灯逆向交替呼吸
      break;
    }

    case MODE_FIREFLY: { // 11: 夏夜双萤火虫自然混沌呼吸 (双独立非对称正弦呼吸发生器)
      unsigned long now = millis();
      // 绿灯呼吸周期 3000ms (浮点正弦函数)
      float radGreen = (now % 3000) * 2.0 * PI / 3000.0;
      int valGreen = (sin(radGreen) + 1.0) * 511.5;
      
      // 红灯呼吸周期 2200ms
      float radRed = (now % 2200) * 2.0 * PI / 2200.0;
      int valRed = (sin(radRed) + 1.0) * 511.5;
      
      analogWrite(ledGreen, valGreen);
      analogWrite(ledRed, valRed);
      break;
    }

    case MODE_ECG: { // 12: 医疗监护仪心电波模拟 (红灯ECG，绿灯血氧同步，极其高拟真)
      unsigned long now = millis() % 1200; // 1.2秒心跳周期
      int rVal = 0;
      int gVal = 50; // 绿灯底噪暗光，证明系统在线
      
      if (now < 100) {
        rVal = (now * 150) / 100; // P波渐隆起 (明暗微亮)
      } else if (now >= 100 && now < 200) {
        rVal = 0; // PR段静息
      } else if (now >= 200 && now < 280) {
        rVal = 1023; // QRS陡峰 (暴闪大亮)
        gVal = 1023; // 脉搏同步亮绿
      } else if (now >= 280 && now < 450) {
        rVal = 0; // ST段静息
      } else if (now >= 450 && now < 700) {
        // T波隆起：450~700ms 共 250ms
        float rad = ((now - 450) * PI) / 250.0;
        rVal = sin(rad) * 300; // T波中等圆弧亮灭
      } else {
        rVal = 0; // TP段长静息期
      }
      
      analogWrite(ledRed, rVal);
      analogWrite(ledGreen, gVal);
      break;
    }

    case MODE_TICKTOCK: { // 13: 安全防护摆钟滴答计时 (绿常亮，红灯秒级短脉冲)
      unsigned long now = millis() % 1000;
      digitalWrite(ledGreen, HIGH);
      digitalWrite(ledRed, (now < 50) ? HIGH : LOW); // 红灯每秒极短促亮 50ms (滴答提示)
      break;
    }

    case MODE_PHASE_CHASE: { // 14: 正余弦跑马旋转霓虹灯 (90度相位差交错变光，支持用 i 调速)
      unsigned long now = millis();
      // 使用动态 flashInterval 作为周期参考 (乘以4倍防止变化过快)
      float rad = (now % (flashInterval * 4)) * 2.0 * PI / (flashInterval * 4.0);
      int valGreen = (sin(rad) + 1.0) * 511.5;
      int valRed = (cos(rad) + 1.0) * 511.5; // 相位差 90 度 (sin 与 cos)
      
      analogWrite(ledGreen, valGreen);
      analogWrite(ledRed, valRed);
      break;
    }

    case MODE_STROBE_CHASE: { // 15: 特种爆闪追击爆裂灯语 (绿3爆闪 -> 停顿 -> 红3爆闪 -> 停顿)
      unsigned long now = millis() % 660; // 660ms为一个完整的爆闪追逐周期
      int gState = LOW;
      int rState = LOW;
      
      if (now < 180) { // 绿灯爆闪区：180ms 内，每 60ms 里亮 30ms 灭 30ms (爆闪3下)
        int sub = now % 60;
        gState = (sub < 30) ? HIGH : LOW;
        rState = LOW;
      } else if (now >= 180 && now < 330) { // 绿灯完后停顿区 (150ms)
        gState = LOW;
        rState = LOW;
      } else if (now >= 330 && now < 510) { // 红灯爆闪区 (330~510ms，爆闪3下)
        int sub = (now - 330) % 60;
        rState = (sub < 30) ? HIGH : LOW;
        gState = LOW;
      } else { // 红灯完后停顿区 (510~660ms，大停顿150ms)
        gState = LOW;
        rState = LOW;
      }
      
      digitalWrite(ledGreen, gState);
      digitalWrite(ledRed, rState);
      break;
    }

    case MODE_TAICHI: { // 16: 太极阴阳双鱼呼吸 (三阶正弦S形柔滑转换)
      unsigned long now = millis();
      float rad = (now % 3000) * 2.0 * PI / 3000.0;
      float s = sin(rad);
      float s3 = s * s * s; // 引入三阶正弦映射，拉长顶点停留，塑造太极S形阴阳消长曲线
      
      int valGreen = (s3 + 1.0) * 511.5;
      int valRed = (1.0 - s3) * 511.5; // 红绿一盛一衰，对立相生
      
      analogWrite(ledGreen, valGreen);
      analogWrite(ledRed, valRed);
      break;
    }

    case MODE_HELLO_MORSE: { // 17: 极客问候语 "HELLO" 摩尔斯广播 (单词高精度序列电码)
      unsigned long now = millis();
      if (now - prevHelloMillis >= helloPattern[helloStep]) {
        prevHelloMillis = now;
        helloStep = (helloStep + 1) % helloTotalSteps;
      }
      
      // 数学对称定理：凡是偶数索引，均为亮电平；奇数和长间隔索引均为灭电平
      bool isLight = (helloStep % 2 == 0);
      
      // 双灯同步广播 "H-E-L-L-O" 极客电码
      digitalWrite(ledGreen, isLight ? HIGH : LOW);
      digitalWrite(ledRed, isLight ? HIGH : LOW);
      break;
    }

    case MODE_RADAR: { // 18: 科幻雷达扫描与锁定警告 (绿灯缓慢扫描，红灯突发锁定)
      unsigned long now = millis() % 4500; // 4.5秒探测大周期
      int gVal = 0;
      int rVal = 0;
      
      if (now < 3000) { // 0~3s 雷达扫描期 (绿灯扫描起伏，红灯维持防区暗淡底火)
        float rad = (now * PI) / 1500.0; // 3s内完成一个正弦呼吸周期
        gVal = 200 + sin(rad) * 823;     // 绿灯在 200~1023 范围深呼吸
        rVal = 30;                       // 红灯保持极弱底噪亮度，表示正常戒备
      } else if (now >= 3000 && now < 4000) { // 3s~4s 锁定暴闪区 (1秒爆发4击强力重击爆闪)
        gVal = 1023; // 绿灯暴亮锁定
        unsigned long sub = (now - 3000) % 250; // 每250ms一次高频闪动 (125ms亮，125ms灭)
        rVal = (sub < 125) ? 1023 : 0;
      } else { // 4s~4.5s 最终锁定大亮期 (红绿双灯全亮 500ms，显示锁定完成)
        gVal = 1023;
        rVal = 1023;
      }
      analogWrite(ledGreen, gVal);
      analogWrite(ledRed, rVal);
      break;
    }
    default:
      // 防御性安全处理，若出现未定义状态，默认全灭
      digitalWrite(ledGreen, LOW);
      digitalWrite(ledRed, LOW);
      break;
  }
}

// ==========================================
// 📌 物联网状态数据闭环反馈
// ==========================================
void reportStatus() {
  if (client.connected()) {
    char statusMsg[4];
    itoa((int)currentMode, statusMsg, 10);
    client.publish(topic_status, statusMsg);
    Serial.print("[MQTT] Status feedback published. Current mode: ");
    Serial.println(statusMsg);
  }
}