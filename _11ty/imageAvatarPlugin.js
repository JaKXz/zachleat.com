const eleventyImage = require("@11ty/eleventy-img");

if(process.env.ELEVENTY_PRODUCTION) {
	eleventyImage.concurrency = 20;
}

function getImageOptions(username) {
	return {
		widths: [72],
		urlPath: "/img/avatars/",
		outputDir: "./img/avatars/",
		formats: process.env.ELEVENTY_PRODUCTION ? ["avif", "webp", "jpeg"] : ["webp", "jpeg"],
		dryRun: true,
		cacheDuration: "*",
		filenameFormat: function(id, src, width, format) {
			return `${username.toLowerCase()}.${format}`;
		}
	};
}

async function imgAvatar(username, classes = "") {
	// We know where the images will be
	let fakeUrl = `https://twitter.com/${username}.jpg`;
	let imgData = eleventyImage.statsByDimensionsSync(fakeUrl, 400, 400, getImageOptions(username));
	let markup = eleventyImage.generateHTML(imgData, {
		alt: `${username}’s Avatar`,
		class: "z-avatar" + (classes ? ` ${classes}` : ""),
		loading: "lazy",
		decoding: "async",
	}, {
		whitespaceMode: "inline"
	});

	return markup;
}

module.exports = function(eleventyConfig) {
	// this will no longer generate new images so don’t use it
	async function twitterAvatarHtml(username, classes = "") {
		return imgAvatar(username, classes);
	}

	// this will no longer generate new images so don’t use it
	eleventyConfig.addAsyncShortcode("imgavatar", twitterAvatarHtml);


	function indieAvatarHtml(url = "", classes = "z-avatar", onerror = "") {
		let screenshotUrl = `https://v1.indieweb-avatar.11ty.dev/${encodeURIComponent(url)}/`;
		return `<img alt="IndieWeb Avatar for ${url}" class="${classes}" loading="lazy" decoding="async" src="${screenshotUrl}" width="60" height="60"${onerror ? ` onerror="${onerror}"`: ""}>`;
	}

	eleventyConfig.addLiquidShortcode("indieAvatar", indieAvatarHtml);

	eleventyConfig.addLiquidShortcode("indieAvatarBare", function(url = "", classes = "") {
		let origin;
		try {
			origin = (new URL(url)).origin;
		} catch(e) {
			origin = url;
		}

		return indieAvatarHtml(origin, classes, "this.parentNode.classList.add('error')");
	});
};
