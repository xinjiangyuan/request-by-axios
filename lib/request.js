import axios from 'axios'
import { isFunction, isPrimitiveButString } from './util'
import {
  addByConfig,
  cancelByConfig,
} from './queen'

function requestTrim(config) {
  const {
    data,
    params,
    autoTrim,
    trimFn
  } = config
  if (autoTrim || trimFn) {
    try {
      if (isFunction(trimFn)) {
        return trimFn(config)
      }
      if (!String.prototype.trim) {
        String.prototype.trim = function () {
          return this.replace(/^\s+|\s+$/g, '')
        }
      }

      function itTrim(value, key, obj) {
        // 非对象引用和string类型
        if (isPrimitiveButString(value) || value === null) {
          return
        }
        if (typeof value === 'string') {
          return obj[key] = value.trim()
        }
        if (value instanceof FormData) {
          return new Set(Array.from(value.keys())).forEach(name => {
            const valuesByName = value.getAll(name)
            value.delete(name)
            valuesByName.map(item => {
              return item instanceof File ? item : item.trim()
            }).forEach(item => {
              value.append(name, item)
            })
          })
        }
        Object.entries(value).forEach(item => itTrim(item[1], item[0], value))
      }

      itTrim(data)
      itTrim(params)
    } catch (error) {
      console.error('自动trim失败', error)
    }
  }
}

function requestInfoLog(config) {
  if (config.log && process.env.NODE_ENV === "development") {
    config.timestamp = +new Date()
    console.log('start... ', config.url, {
      pagePath: location.href,
      requestUrl: config.url,
      timestamp: config.timestamp,
      data: config.data,
      params: config.params,
      method: config.method
    });
  }
}

function openLoading () {

}

export default function requestInterceptor(axiosInstance) {
  axiosInstance.interceptors.request.use(config => {
    const {
      beforeAxiosSend, cancelModel, log, onHeaderCreated
    } = config

    if (log) {
      console.log(config)
    }

    // 参数去空格
    requestTrim(config)

    let cancel
    config.cancelToken = new axios.CancelToken(c => cancel = c)

    // 中断策略
    if(cancelModel) {
      cancelByConfig(config, cancel)
    }

    config.cancel = cancel

    // 加入队列
    addByConfig(config)
   
    requestInfoLog(config)

    // 开启加载
    openLoading()

    if (isFunction(onHeaderCreated)) {
      onHeaderCreated(config)
    }
    
    if (isFunction(beforeAxiosSend)) {
      beforeAxiosSend(config)
    }
    return config
  }, error => {
    return Promise.reject(error);
  })
}
