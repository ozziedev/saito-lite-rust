module.exports = (streamId, muted, ui_type) => {
  return `
    <div id="stream${streamId}"  class="${ui_type === "large" ? "video-box-container-large" : "video-box-container"}">
      <video ${muted ? "muted" : " "} autoplay playsinline="true" class="video-box"></video>
    </div>`

}

