import Taro from '@tarojs/taro'

const INIT_KEY = 'wordflash_initialized_v2'

export function isInitialized(): boolean {
  return !!Taro.getStorageSync(INIT_KEY)
}

export function markInitialized(): void {
  Taro.setStorageSync(INIT_KEY, true)
}

export async function initializeWordData(): Promise<boolean> {
  if (isInitialized()) return true

  try {
    console.log('开始初始化词库数据...')

    // Get the base URL for API calls
    const env = Taro.getEnv()
    const baseUrl = env === Taro.ENV_TYPE.WEB ? '' : 'http://localhost:3000'

    const res = await Taro.request({
      url: `${baseUrl}/api/data/init-libraries`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' }
    })

    if (res.statusCode === 200 && res.data?.success) {
      // Write the full database to local storage
      Taro.setStorageSync('wordflash_db', res.data.data)
      markInitialized()
      console.log('词库数据初始化完成:', res.data.summary)
      return true
    } else {
      console.error('词库初始化失败:', res.data)
      return false
    }
  } catch (error) {
    console.error('词库初始化出错:', error)
    return false
  }
}
