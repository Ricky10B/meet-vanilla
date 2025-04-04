export const isHaveCamera = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const hasCamera = devices.some(device => device.kind === 'videoinput' && !device.label.includes("OBS"))
    return hasCamera
  } catch (error) {
    console.error(error)
    throw error
  }
}
