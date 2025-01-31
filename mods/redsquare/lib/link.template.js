module.exports = (link) => {

  console.log('inside link template');
  console.log(link.tweet);

  if (typeof link.tweet.youtube_id != "undefined" && link.tweet.youtube_id != "") {
  
    return `
	    <div class="youtube-embed-container">
	      <iframe class="youtube-embed" src="https://www.youtube.com/embed/${link.tweet.youtube_id}"></iframe>
	    </div>
	  `;
  
  } else if (link.tweet.link_properties != null) {

    return `
	<div class="link-preview">
          <a target="_blank">
            <div class=" link-container">
              <div class="link-img" style="background: url(${link.src}); background-position: center;"></div>
              <div class="link-info">
                <div class="link-url">${link.url}</div>
                <div class="link-title">${link.title}</div>
                <div class="link-description">${link.description}</div>
              </div>
            </div>
          </a>
        </div>
    `;

  }
 
}

