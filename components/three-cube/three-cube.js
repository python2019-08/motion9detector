// components/three-cube/three-cube.js
// ------------------------------------
// https://www.cnblogs.com/FBsharl/p/18880096
// 
// 微信小程序蓝牙陀螺仪数据可视化
// 使用 threejs-miniprogram 构建 3D 立方体组件
// 1. 安装 threejs-miniprogram
// 首先通过 npm 安装官方的小程序适配版本：
// ```
// npm install threejs-miniprogram
// ``` 
// 2. 创建组件文件结构
// ```
// components/
//   three-cube/
//     three-cube.json    # 组件配置文件
//     three-cube.wxml    # 组件模板
//     three-cube.wxss    # 组件样式
//     three-cube.js      # 组件逻辑
// ```
// ------------------------------------
const { createScopedThreejs } = require('threejs-miniprogram')

Component({
  properties: {
    // 初始旋转角度
    initRotation: {
      type: Object,
      value: { x: 0, y: 0, z: 0 }
    },
    // 是否显示角度信息
    showInfo: {
      type: Boolean,
      value: true
    },
    // 画布宽度
    width: {
      type: Number,
      value: 300
    },
    // 画布高度
    height: {
      type: Number,
      value: 300
    },
    // 立方体颜色
    color: {
      type: String,
      value: '#00ff00'
    },
    // 是否显示坐标轴
    showAxes: {
      type: Boolean,
      value: true
    }
  },

  data: {
    rotation: { x: 0, y: 0, z: 0 }
  },

  lifetimes: {
    ready() {
      this.initThreeJS()
    },
    detached() {
      this.stopAnimation()
    },
    pageLifetimes: {
      hide() {
        this.stopAnimation()
      },
      show() {
        if (this.renderer) {
          this.startAnimation()
        }
      }
    }
  },

  methods: {
    initThreeJS() {
      this.setData({
        rotation: this.properties.initRotation
      })

      const query = this.createSelectorQuery()
      query.select('#webgl')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res[0].node
          const width = res[0].width || this.properties.width
          const height = res[0].height || this.properties.height

          // 使用小程序适配的Three.js
          const THREE = createScopedThreejs(canvas)

          // 初始化渲染器
          this.renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true
          })
          this.renderer.setSize(width, height)
          this.renderer.setClearColor(0xeeeeee)

          // 创建场景
          this.scene = new THREE.Scene()

          // 创建相机
          this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
          this.camera.position.z = 5

          // 创建立方体
          const geometry = new THREE.BoxGeometry(1, 1, 1)
          const material = new THREE.MeshBasicMaterial({ 
            color: new THREE.Color(this.properties.color),
            wireframe: false
          })
          this.cube = new THREE.Mesh(geometry, material)
          this.scene.add(this.cube)

          // 添加坐标轴辅助
          if (this.properties.showAxes) {
            this.axesHelper = new THREE.AxesHelper(2)
            this.scene.add(this.axesHelper)
          }

          // 开始动画
          this.startAnimation()
        })
    },

    startAnimation() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
      }

      const render = () => {
        if (this.cube) {
          this.cube.rotation.x = this.data.rotation.x * Math.PI / 180
          this.cube.rotation.y = this.data.rotation.y * Math.PI / 180
          this.cube.rotation.z = this.data.rotation.z * Math.PI / 180
        }

        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera)
        }

        this.animationFrameId = requestAnimationFrame(render)
      }

      render()
    },

    stopAnimation() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = null
      }
    },

    // 外部调用的方法：更新旋转角度
    updateRotation(rotation) {
      this.setData({
        rotation: {
          x: rotation.x || this.data.rotation.x,
          y: rotation.y || this.data.rotation.y,
          z: rotation.z || this.data.rotation.z
        }
      })
    },

    // 外部调用的方法：设置立方体颜色
    setColor(color) {
      if (this.cube) {
        this.cube.material.color.set(new THREE.Color(color))
      }
    },

    // 外部调用的方法：切换坐标轴显示
    toggleAxes(show) {
      if (this.axesHelper) {
        this.axesHelper.visible = show
      }
    }
  }
})