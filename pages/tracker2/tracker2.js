Page({
  data: {
    isMonitoring: false,
    motionStateText: '静止',
    motionStateClass: 'status-idle',
    directionText: '未知',
    gyroData: {
      x: 0,
      y: 0,
      z: 0
    },
    // 运动状态检测
    motionState: 'idle', // idle, walking, rotating, shaking
    // 轨迹数据
    pathPoints: [],
    lastPoint: null,
    canvasContext: null,
    // 陀螺仪数据缓冲区（用于平滑处理）
    gyroBuffer: {
      x: [],
      y: [],
      z: []
    },
    bufferSize: 10
  },

  onLoad() {
    // 初始化画布
    this.initCanvas();
  },

  onUnload() {
    // 页面卸载时停止监听
    if (this.data.isMonitoring) {
      this.stopGyroscope();
    }
  },

  // 初始化画布
  initCanvas() {
    const context = wx.createCanvasContext('motionCanvas', this);
    this.setData({
      canvasContext: context
    });
    
    // 绘制初始网格和中心点
    this.drawGrid();
    this.drawCenterPoint();
  },

  // 绘制网格
  drawGrid() {
    const ctx = this.data.canvasContext;
    const width = 340; // 画布宽度
    const height = 400; // 画布高度
    const gridSize = 40; // 网格大小
    
    ctx.setStrokeStyle('#e0e0e0');
    ctx.setLineWidth(1);
    
    // 绘制垂直线
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    
    // 绘制水平线
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    
    ctx.stroke();
  },

  // 绘制中心点
  drawCenterPoint() {
    const ctx = this.data.canvasContext;
    const centerX = 170; // 画布中心X
    const centerY = 200; // 画布中心Y
    
    ctx.setFillStyle('#2196F3');
    ctx.beginPath();
    ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.draw();
  },

  // 开始/停止监测
  toggleMonitoring() {
    if (this.data.isMonitoring) {
      this.stopGyroscope();
    } else {
      this.startGyroscope();
    }
  },


  // 开始陀螺仪监测
  startGyroscope() {
    const that = this;
    
    // 监听陀螺仪数据
    wx.startGyroscope({
      interval: 'game',
      success: () => {
        that.setData({
          isMonitoring: true
        });
        
        wx.onGyroscopeChange((res) => {
          that.processGyroData(res);
        });
      },
      fail: (err) => {
        wx.showToast({
          title: '陀螺仪启动失败',
          icon: 'none'
        });
        console.error('陀螺仪启动失败:', err);
      }
    });
  },
  // 停止陀螺仪监测
  stopGyroscope() {
    wx.stopGyroscope();
    wx.offGyroscopeChange();
    
    this.setData({
      isMonitoring: false,
      motionStateText: '静止',
      motionStateClass: 'status-idle'
    });
  },

  // 处理陀螺仪数据
  processGyroData(res) {
    // 更新陀螺仪数据显示
    this.setData({
      gyroData: {
        x: res.x,
        y: res.y,
        z: res.z
      }
    });
    
    // 添加到缓冲区
    this.addToBuffer(res);
    
    // 分析运动状态
    this.analyzeMotion();
    
    // 更新轨迹
    this.updatePath();
  },

  // 添加到数据缓冲区（平滑处理）
  addToBuffer(data) {
    const buffer = this.data.gyroBuffer;
    
    // 添加新数据
    buffer.x.push(data.x);
    buffer.y.push(data.y);
    buffer.z.push(data.z);
    
    // 保持缓冲区大小
    if (buffer.x.length > this.data.bufferSize) {
      buffer.x.shift();
      buffer.y.shift();
      buffer.z.shift();
    }
    
    this.setData({
      gyroBuffer: buffer
    });
  },

  // 分析运动状态
  analyzeMotion() {
    const buffer = this.data.gyroBuffer;
    
    // 计算缓冲区数据的标准差（波动程度）
    const xStd = this.calculateStd(buffer.x);
    const yStd = this.calculateStd(buffer.y);
    const zStd = this.calculateStd(buffer.z);
    
    // 计算总波动
    const totalVariation = xStd + yStd + zStd;
    
    // 判断运动状态
    let newState = 'idle';
    let stateText = '静止';
    let stateClass = 'status-idle';
    
    if (totalVariation > 0.5) {
      // 高波动，可能是行走或抖动
      if (zStd > 0.3 && Math.abs(buffer.z[buffer.z.length-1]) < 0.1) {
        // Z轴有规律波动且平均值接近0，可能是行走
        newState = 'walking';
        stateText = '行走中';
        stateClass = 'status-walking';
      } else if (xStd > 0.4 || yStd > 0.4) {
        // X或Y轴有较大波动，可能是旋转
        newState = 'rotating';
        stateText = '旋转中';
        stateClass = 'status-rotating';
      } else {
        // 其他高波动情况，判断为抖动
        newState = 'shaking';
        stateText = '手臂抖动';
        stateClass = 'status-shaking';
      }
    }
    
    // 更新运动状态显示
    if (this.data.motionState !== newState) {
      this.setData({
        motionState: newState,
        motionStateText: stateText,
        motionStateClass: stateClass
      });
    }
    
    // 更新方向显示
    this.updateDirectionDisplay(buffer);
  },

  // 计算标准差
  calculateStd(arr) {
    if (arr.length === 0) 
      return 0;
    
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const squareDiffs = arr.map(value => {
      const diff = value - mean;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b) / squareDiffs.length;
    
    return Math.sqrt(avgSquareDiff);
  },

  // 更新方向显示
  updateDirectionDisplay(buffer) {
    if (buffer.x.length < 5) 
        return;
    
    // 使用最近几个数据点判断主要运动方向
    const recentX = buffer.x.slice(-5);
    const recentY = buffer.y.slice(-5);
    
    const avgX = recentX.reduce((a, b) => a + b) / recentX.length;
    const avgY = recentY.reduce((a, b) => a + b) / recentY.length;
    
    let direction = '未知';
    
    // 根据X/Y轴角速度判断方向
    if (Math.abs(avgX) > Math.abs(avgY)) {
      // X轴主导（左右转向）
      direction = avgX > 0 ? '向右转' : '向左转';
    } else {
      // Y轴主导（前后倾斜）
      direction = avgY > 0 ? '向前倾' : '向后仰';
    }
    
    // 如果波动很小，显示为"直行"
    if (Math.abs(avgX) < 0.05 && Math.abs(avgY) < 0.05) {
      direction = '直行';
    }
    
    this.setData({
      directionText: direction
    });
  },

  // 更新运动轨迹
  updatePath() {
    if (this.data.motionState !== 'walking') 
      return;
    
    const buffer = this.data.gyroBuffer;
    if (buffer.x.length < 2) 
      return;
    
    // 使用X/Y轴角速度计算位移
    const deltaX = buffer.x[buffer.x.length-1] * 10; // 缩放因子
    const deltaY = buffer.y[buffer.y.length-1] * 10;
    
    // 获取上一个点或使用中心点
    let lastX, lastY;
    if (this.data.lastPoint) {
      lastX = this.data.lastPoint.x;
      lastY = this.data.lastPoint.y;
    } else {
      lastX = 170; // 画布中心X
      lastY = 200; // 画布中心Y
    }
    
    // 计算新点位置
    const newX = Math.max(10, Math.min(330, lastX + deltaX)); // 限制在画布内
    const newY = Math.max(10, Math.min(390, lastY + deltaY));
    
    const newPoint = { x: newX, y: newY };
    
    // 添加到路径点
    const pathPoints = this.data.pathPoints;
    pathPoints.push(newPoint);
    
    // 保持路径点数量合理
    if (pathPoints.length > 100) {
      pathPoints.shift();
    }
    
    this.setData({
      pathPoints: pathPoints,
      lastPoint: newPoint
    });
    
    // 绘制路径
    this.drawPath();
  },

  // 绘制运动路径
  drawPath() {
    const ctx = this.data.canvasContext;
    const pathPoints = this.data.pathPoints;
    
    if (pathPoints.length < 2) return;
    
    // 清除画布
    ctx.clearRect(0, 0, 340, 400);
    
    // 重新绘制网格和中心点
    this.drawGrid();
    this.drawCenterPoint();
    
    // 设置路径样式
    ctx.setStrokeStyle('#4CAF50');
    ctx.setLineWidth(3);
    ctx.setLineCap('round');
    ctx.setLineJoin('round');
    
    // 开始绘制路径
    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
    }
    
    ctx.stroke();
    
    // 绘制当前位置点
    const lastPoint = pathPoints[pathPoints.length-1];
    ctx.setFillStyle('#F44336');
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.draw();
  },

  // 清除画布
  clearCanvas() {
    const ctx = this.data.canvasContext;
    
    // 清除画布
    ctx.clearRect(0, 0, 340, 400);
    
    // 重置路径数据
    this.setData({
      pathPoints: [],
      lastPoint: null
    });
    
    // 重新绘制网格和中心点
    this.drawGrid();
    this.drawCenterPoint();
  },

  // 画布触摸事件（用于测试）
  canvasTouchStart(e) {
    this.setData({
      touchStart: e.touches[0]
    });
  },

  canvasTouchMove(e) {
    // 可以添加手动绘制功能（测试用）
  },

  canvasTouchEnd(e) {
    // 触摸结束处理
  }
})