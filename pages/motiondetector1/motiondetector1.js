const MotionDetection = require('../../utils/motio_detection.js');

Page({
  data: {
    isMonitoring: false,
    motionState: {
      isMoving: false,
      isWalking: false,
      direction: 'stationary',
      distance: 0,
      stepCount: 0,
      speed: 0
    },

    // sensorData格式化后的显示数据
    sensorDisplayData: {
      accel: { x: '0.0000', y: '0.0000', z: '0.0000' },
      gyro: { x: '0.0000', y: '0.0000', z: '0.0000' }
    },    
    // 
    directionText: '静止',
    showSettingsPanel: false,
    params: {
      stepThreshold: 1.2,
      walkThreshold: 0.15,
      avgStepLength: 0.7
    },
    // ---trajectory,start
    trajectory: [],
    currentPosition: { x: 0, y: 0 },
    distance: 0
    // ---trajectory,end
  },

  // -------------------------------------------
  // -------非显示数据
    
    // sensorData
    sensorData: {
        accel: { x: 0, y: 0, z: 0 },
        gyro: { xsensorData: 0, y: 0, z: 0 }
    },  
    // Canvas 相关属性和方法
    canvasContext: null,
    canvasNode: null,
    dpr: 1,
  // -------------------------------------------  
  onLoad() {
    this.motionDetector = new MotionDetection();    
    this.canvasContext = null; 
  },
  
  onReady() {
    // 初始化画布
    this.initCanvas();    
  },

  onUnload() {
    this.stopMonitoring();
  },

// 初始化 Canvas
initCanvas() {
  const query = wx.createSelectorQuery();
  query.select('#motionCanvas')
    .fields({ node: true, size: true })
    .exec((res) => {
      if (!res[0] || !res[0].node) {
        console.error('未找到 Canvas 元素');
        return;
      }
      
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      
      // ✅ 正确初始化 Canvas 尺寸
      this.dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = res[0].width * this.dpr;
      canvas.height = res[0].height * this.dpr;
      ctx.scale(this.dpr, this.dpr);
      
      // ✅ 正确存储 Context（不在 data 中）
      this.canvasContext = ctx;
      this.canvasNode = canvas;
      
      console.log('Canvas 初始化完成，开始绘图');
      
      // 执行绘图操作
      this.drawGrid();
      this.drawCenterPoint();
    });
},

// 绘制网格
drawGrid() {
  const ctx = this.canvasContext;
  if (!ctx) {
    console.error('Canvas Context 未初始化，无法绘制网格');
    return;
  }
  
  console.log('开始绘制网格，Canvas Context:', ctx);
  
  const width = 380;
  const height = 400;
  const gridSize = 40;
  
  // 保存当前绘图状态
  ctx.save();
  
  // 设置网格样式
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]); // 虚线网格
  
  // 开始绘制网格路径
  ctx.beginPath();
  
  // 绘制垂直网格线
  for (let x = gridSize; x < width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  
  // 绘制水平网格线
  for (let y = gridSize; y < height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  
  // 绘制所有网格线
  ctx.stroke();
  
  // 恢复之前的状态
  ctx.restore();
  
  console.log('网格绘制完成');
},

// 绘制中心点
drawCenterPoint() {
  const ctx = this.canvasContext;
  if (!ctx) {
    console.error('Canvas Context 未初始化，无法绘制中心点');
    return;
  }
  
  const centerX = 170;
  const centerY = 200;
  
  // 保存当前状态
  ctx.save();
  
  // 绘制中心圆点
  ctx.beginPath();
  ctx.fillStyle = '#2196F3';
  ctx.arc(centerX, centerY, 6, 0, 2 * Math.PI);
  ctx.fill();
  
  // 绘制十字准星
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 2;
  ctx.setLineDash([]); // 实线
  
  ctx.beginPath();
  // 水平线
  ctx.moveTo(centerX - 20, centerY);
  ctx.lineTo(centerX + 20, centerY);
  // 垂直线
  ctx.moveTo(centerX, centerY - 20);
  ctx.lineTo(centerX, centerY + 20);
  ctx.stroke();
  
  // 恢复状态
  ctx.restore();
  
  console.log('中心点绘制完成');
},

  
  // 开始/停止监测
  toggleMonitoring() {
    if (this.data.isMonitoring) {
      this.stopMonitoring();
    } else {
      this.startMonitoring();
    }
  },

  // 开始监测
  startMonitoring() { 
    const that = this;    
    
    // 启动加速度计
    wx.startAccelerometer({
      interval: 'game',
      success: () => {
        console.log('加速度计启动成功');
        
        // 启动陀螺仪
        wx.startGyroscope({
          interval: 'game',
          success: () => {
            console.log('陀螺仪启动成功');
            that.setData({ isMonitoring: true });

            that.setupSensorListeners();
          },
          fail: (err) => {
            console.error('陀螺仪启动失败:', err);
            wx.showToast({ title: '陀螺仪启动失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('加速度计启动失败:', err);
        wx.showToast({ title: '加速度计启动失败', icon: 'none' });
      }
    });

    // 开始绘制循环
    this.drawLoop(); //trajectory   
  },

  // 停止监测
  stopMonitoring() { 
    // 方法2：移除所有监听器（更彻底）
    wx.offAccelerometerChange(); // 不传callback移除所有
    wx.offGyroscopeChange();

    wx.stopAccelerometer();
    wx.stopGyroscope();
    
    this.setData({ isMonitoring: false });
  },

  formatSensorData(rawData) {
    return { 
        x: rawData.x.toFixed(4),
        y: rawData.y.toFixed(4),
        z: rawData.z.toFixed(4)      
    };
  },

  // 设置传感器监听
  setupSensorListeners() {
    const that = this;
    
    // 加速度计数据监听
    wx.onAccelerometerChange((res) => {
      const formatted = this.formatSensorData(res);

      that.sensorData.accel = res;
      that.setData({ 
        "sensorDisplayData.accel":formatted
      });
      
      // 处理传感器数据
      that.processSensorData();
    });
    
    // 陀螺仪数据监听
    wx.onGyroscopeChange((res) => {
      const formatted = this.formatSensorData(res);

      that.sensorData.gyro = res;
      that.setData({ 
        "sensorDisplayData.gyro":formatted
      });
    });
  },

  // 处理传感器数据
  processSensorData() {
    if(!this.data.isMonitoring){
      return;
    }
    const motionState = this.motionDetector.processSensorData(
      this.sensorData.accel,
      this.sensorData.gyro,
      Date.now()
    );
    
    this.setData({
      motionState: motionState,
      directionText: this.getDirectionText(motionState.direction)
    });
  },

  // 获取方向文本
  getDirectionText(direction) {
    const texts = {
      'stationary': '静止',
      'forward': '前进',
      'backward': '后退',
      'uncertain': '方向不确定'
    };
    return texts[direction] || '未知';
  },

  // 重置数据
  resetData() {
    this.motionDetector.reset();
    this.setData({
      motionState: {
        isMoving: false,
        isWalking: false,
        direction: 'stationary',
        distance: 0,
        stepCount: 0,
        speed: 0
      },
      sensorDisplayData: {
        accel: { x: '0.0000', y: '0.0000', z: '0.0000' },
        gyro: { x: '0.0000', y: '0.0000', z: '0.0000' }
      } 
    });

    // resetTrajectory();// trajectory
  },

  // ----------draw trajectory--------

  // 重置轨迹
  resetTrajectory() {
    // this.motionDetector.reset();
    this.setData({ 
      trajectory: [],
      currentPosition: { x: 0, y: 0 },
      distance: 0 
    });
    this.drawGrid();
  },

  // 绘制循环
  drawLoop() {
    if (!this.data.isMonitoring) 
        return;
    
    // 更新显示
    const currentPos = this.motionDetector.getPosition();
    const trajectory = this.motionDetector.getTrajectory();
    
    this.setData({
      currentPosition: currentPos,
      trajectory: trajectory,
      distance: this.calculateDistance(trajectory)
    });
    
    // 绘制轨迹
    this.drawTrajectory(trajectory);
    
    // 继续循环
    setTimeout(() => {
      this.drawLoop();
    }, 100);
  },

  // 计算总距离
  calculateDistance(trajectory) {
    if (trajectory.length < 2) 
        return 0;
    
    let distance = 0;
    for (let i = 1; i < trajectory.length; i++) {
      const dx = trajectory[i].x - trajectory[i-1].x;
      const dy = trajectory[i].y - trajectory[i-1].y;
      distance += Math.sqrt(dx*dx + dy*dy);
    }
    
    return distance.toFixed(2);
  }, 

// 绘制轨迹到Canvas
drawTrajectory(trajectory) {
  if (!this.canvasContext || trajectory.length === 0) 
    return;
  
  const ctx = this.canvasContext;
  const width = 300;
  const height = 300;
  const scale = 50; // 像素/米
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  // 绘制网格
  this.drawGrid(ctx, width, height);
  
  // 绘制轨迹线
  ctx.beginPath();
  ctx.strokeStyle = '#2196F3';
  ctx.lineWidth = 2;
  
  trajectory.forEach((point, index) => {
    const x = width/2 + point.x * scale;
    const y = height/2 - point.y * scale; // 注意Y轴方向
    
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // 绘制当前位置点
  if (trajectory.length > 0) {
    const current = trajectory[trajectory.length - 1];
    const x = width/2 + current.x * scale;
    const y = height/2 - current.y * scale;
    
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4444';
    ctx.fill();
  }
},

  //------- 显示设置面板 ------
  showSettings() {
    this.setData({ showSettingsPanel: true });
  },

  // 隐藏设置面板
  hideSettings() {
    this.setData({ showSettingsPanel: false });
  },

  // 参数变更处理
  onStepThresholdChange(e) {
    const value = e.detail.value;
    this.setData({
      'params.stepThreshold': value
    });
    this.motionDetector.updateParams({ stepThreshold: value });
  },

  onWalkThresholdChange(e) {
    const value = e.detail.value;
    this.setData({
      'params.walkThreshold': value
    });
    this.motionDetector.updateParams({ walkThreshold: value });
  },

  onStepLengthChange(e) {
    const value = e.detail.value;
    this.setData({
      'params.avgStepLength': value
    });
    this.motionDetector.updateParams({ avgStepLength: value });
  }
});