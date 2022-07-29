const pkg = require("./package.json");
const { DateTime } = require("luxon");
const { URL } = require("url");
const sanitizeHTML = require("sanitize-html");
const numeral = require("numeral");
const randomCase = require('random-case');
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const {encode} = require("html-entities");
const Natural = require('natural');

const pluginRss = require("@11ty/eleventy-plugin-rss");
const pluginSyntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const { EleventyRenderPlugin } = require("@11ty/eleventy");

const siteData = require("./_data/site.json");
const analyticsData = require("./_data/analytics.json");
const webmentionBlockList = require("./_data/webmentionsBlockList.json");
const getBaseUrl = require("./_includes/getBaseUrl");
const pluginImage = require("./_includes/imagePlugin");
const screenshotImageHtmlFullUrl = pluginImage.screenshotImageHtmlFullUrl;
const pluginImageAvatar = require("./_includes/imageAvatarPlugin");

const analyze = new Natural.SentimentAnalyzer("English", Natural.PorterStemmer, "afinn");

module.exports = function(eleventyConfig) {
	eleventyConfig.setUseGitIgnore(false);
	eleventyConfig.setDataDeepMerge(true);
	eleventyConfig.setQuietMode(true);

	eleventyConfig.setServerOptions({
		domdiff: false,
		showVersion: true,
	});

	/* PLUGINS */
	eleventyConfig.addPlugin(pluginRss);
	eleventyConfig.addPlugin(pluginSyntaxHighlight);
	eleventyConfig.addPlugin(pluginImage);
	eleventyConfig.addPlugin(pluginImageAvatar);
	eleventyConfig.addPlugin(EleventyRenderPlugin);

	/* COPY */
	eleventyConfig
		.addPassthroughCopy("img/")
		.addPassthroughCopy({
			"node_modules/lite-youtube-embed/src/lite-yt-embed.js": `web/dist/${pkg.version}/lite-yt-embed.js`,
			"node_modules/speedlify-score/speedlify-score.js": `web/dist/${pkg.version}/speedlify-score.js`,
		})
		.addPassthroughCopy("humans.txt")
		.addPassthroughCopy("resume/index.css")
		.addPassthroughCopy("web/css/fonts")
		.addPassthroughCopy("web/css/external")
		.addPassthroughCopy("web/img")
		.addPassthroughCopy("web/wp-content")
		.addPassthroughCopy("web/dist")
		.addPassthroughCopy("og/*.jpeg")
		.addPassthroughCopy("og/*.png")
		.addPassthroughCopy("og/sources/");

	// Production only passthrough copy
	if(process.env.ELEVENTY_PRODUCTION) {
		eleventyConfig
			.addPassthroughCopy("keybase.txt")
			.addPassthroughCopy("_redirects")
			.addPassthroughCopy("demos/")
			.addPassthroughCopy("resume/resume.pdf")
			.addPassthroughCopy("presentations/")
			.addPassthroughCopy("archive/")
			.addPassthroughCopy("web-fonts/foitfout/")
			.addPassthroughCopy("alarmd/");
	}

	/* LAYOUTS */
	eleventyConfig.addLayoutAlias('default', 'layouts/default.liquid');
	eleventyConfig.addLayoutAlias('page', 'layouts/page.liquid');
	eleventyConfig.addLayoutAlias('post', 'layouts/post.liquid');

	/* FILTERS */
	eleventyConfig.addFilter("leftpad", (str, length = 3) => {
		let padding = Array.from({length}).map(t => "0").join("");
		return (padding + str).substring((""+str).length);
	});

	eleventyConfig.addFilter("truncate", (str, len = 280) => { // tweet sized default
		let suffix = str.length > len ? `… <span class="tag-inline">Truncated</span>` : "";
		return str.substr(0, len) + suffix;
	});

	eleventyConfig.addFilter("selectRandomFromArray", (arr) => {
		let index = Math.floor(Math.random() * arr.length);
		return arr[index];
	});

	eleventyConfig.addLiquidFilter("numberString", function(num) {
		let strs = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
		if( num < strs.length ) {
			return strs[num];
		}
		return num;
	});

	// Count total number of items that have speaking metadata set
	eleventyConfig.addLiquidFilter("getSpeakingCount", function(allCollection, propName, propValueMatch) {
		let count = 0;
		for(let item of allCollection) {
			if(item.data.metadata && item.data.metadata.speaking && item.data.metadata.speaking[propName] && (!propValueMatch || item.data.metadata.speaking[propName] === propValueMatch)) {
				count++;
			}
		}
		return count;
	});

	// Count unique number of items for a speaking metadata property
	eleventyConfig.addLiquidFilter("getSpeakingUniqueCount", function(allCollection, propName) {
		let count = new Set();
		for(let item of allCollection) {
			if(item.data.metadata && item.data.metadata.speaking && item.data.metadata.speaking[propName]) {
				count.add(item.data.metadata.speaking[propName]);
			}
		}
		return count.size;
	});

	eleventyConfig.addLiquidFilter("renderNumber", function renderNumber(num) {
		return numeral(parseInt(num, 10)).format("0,0");
	});

	eleventyConfig.addLiquidFilter("round", function(num, digits = 2) {
		return parseFloat(num).toFixed(digits);
	});

	eleventyConfig.addLiquidFilter("medialengthCleanup", str => {
		let split = str.split(" ");
		return `${split[0]}<span aria-hidden="true">m</span><span class="sr-only"> minutes</span>`;
	});

	eleventyConfig.addLiquidFilter("encodeUriComponent", str => {
		return encodeURIComponent(str);
	});

	eleventyConfig.addLiquidFilter("htmlEntities", str => {
		return encode(str);
	});

	eleventyConfig.addLiquidFilter("absoluteUrl", (url, base) => {
		if( !base ) {
			base = siteData.url;
		}
		try {
			return (new URL(url, base)).toString();
			} catch(e) {
			console.log(`Trying to convert ${url} to be an absolute url with base ${base} and failed.`);
			return url;
		}
	});

	eleventyConfig.addLiquidFilter("timePosted", (startDate, endDate = Date.now()) => {
		if(typeof startDate === "string") {
			startDate = Date.parse(startDate);
		}
		if(typeof endDate === "string") {
			endDate = Date.parse(endDate);
		}
		let numDays = ((endDate - startDate) / (1000 * 60 * 60 * 24));
		let daysPosted = Math.round( parseFloat( numDays ) );
		let yearsPosted = parseFloat( (numDays / 365).toFixed(1) );

		if( daysPosted < 365 ) {
			return daysPosted + " day" + (daysPosted !== 1 ? "s" : "");
		} else {
			return yearsPosted + " year" + (yearsPosted !== 1 ? "s" : "");
		}
	});

	eleventyConfig.addNunjucksFilter("rssNewestUpdatedDate", collection => {
		if( !collection || !collection.length ) {
			throw new Error( "Collection is empty in lastUpdatedDate filter." );
		}

		return DateTime.fromJSDate(collection[ 0 ].date).toISO({ includeOffset: true, suppressMilliseconds: true });
	});

	eleventyConfig.addFilter("readableDate", dateObj => {
		return DateTime.fromJSDate(dateObj).toFormat("LLLL dd, yyyy");
	});

	eleventyConfig.addLiquidFilter("readableDateFromISO", (dateStr, formatStr = "dd LLL yyyy 'at' hh:mma") => {
		return DateTime.fromISO(dateStr).toFormat(formatStr);
	});

	eleventyConfig.addLiquidFilter("twitterUsernameFromUrl", (url) => {
		if( url.indexOf("https://twitter.com/") > -1 ) {
			return "@" + url.replace("https://twitter.com/", "");
		}
	});

	eleventyConfig.addLiquidFilter("getPostCountForYear", (posts, year) => {
		return posts.filter(function(post) {
			if(!post.data.tags) {
				return true;
			}
			if(post.data.tags.includes("draft")) {
				return false;
			}
			return true;
		}).filter(function(post) {
			return post.data.page.date.getFullYear() === parseInt(year, 10);
		}).length;
	});

	//<img src="https://v1.sparkline.11ty.dev/400/100/1,4,10,3,2,40,5,6,20,40,5,1,10,100,5,90/red/" width="400" height="100">
	eleventyConfig.addLiquidFilter("getYearlyPostCount", (posts, startYear = 2007) => {
		let years = [];
		for(let j = startYear; j <= (new Date()).getFullYear(); j++) {
			let year = j;
			let count = posts.filter(function(post) {
				if(!post.data.tags) {
					return true;
				}
				if(post.data.deprecated ||post.data.tags.includes("draft")) {
					return false;
				}
				return true;
			}).filter(function(post) {
				return post.data.page.date.getFullYear() === parseInt(year, 10);
			}).length;
			years.push(count);
		}
		return years.join(",");
	});

	eleventyConfig.addLiquidFilter("getMonthlyPostCount", (posts, year) => {
		let months = [];
		for(let month = 0; month < 12; month++) {
			let count = posts.filter(function(post) {
				if(!post.data.tags) {
					return true;
				}
				if(post.data.deprecated ||post.data.tags.includes("draft")) {
					return false;
				}
				return true;
			}).filter(function(post) {
				let d = post.data.page.date;
				return d.getFullYear() === parseInt(year, 10) && d.getMonth() === month;
			}).length;

			months.push(count);
		}
		return months.join(",");
	});

	eleventyConfig.addLiquidFilter("hostnameFromUrl", (url) => {
		let urlObject = new URL(url);
		return urlObject.hostname;
	});

	eleventyConfig.addLiquidFilter("longWordWrap", str => {
		if( !str || typeof str === "string" && str.indexOf("<") > -1 && str.indexOf(">") > str.indexOf("<")) {
			return str;
		}

		let words = {
			"domcontentloaded": true,
			"getelementsbytagname": true
		};

		return str.split(" ").map(function(word) {
			return word.split("—").map(function(word) {
				return word.split("(").map(function(word) {
					return word.split(")").map(function(word) {
						return words[word.toLowerCase()] || word.length >= 11 ? `<span class="long-word">${word}</span>` : word;
					}).join(")");
				}).join("(");
			}).join("—");
		}).join(" ");
	});

	eleventyConfig.addLiquidFilter("orphanWrap", str => {
		return str.split("—").map(function(str, index, dashSplit) {
			// Uncomment this to prevent orphans only at the end of the string, not before every —
			// if( index !== dashSplit.length - 1 ) {
			// 	return str;
			// }

			let splitSpace = str.split(" ");
			let after = "";
			if( splitSpace.length > 1 ) {
				if( splitSpace.length > 2 ) {
					after += " ";
				}

				// TODO strip HTML from this?
				let lastWord = splitSpace.pop();
				let secondLastWord = splitSpace.pop();
				// skip when last two words are super long 😭
				if(`${secondLastWord} ${lastWord}`.length >= 15) {
					after += `${secondLastWord} ${lastWord}`;
				} else {
					after += `<span class="prevent-orphan">${secondLastWord} ${lastWord}</span>`;
				}
			}

			return splitSpace.join(" ") + after;
		}).join("​—​");
	});

	eleventyConfig.addLiquidFilter("emoji", function(content) {
		return `<span aria-hidden="true" class="emoji">${content}</span>`;
	});

	eleventyConfig.addLiquidFilter("wordcount", function(content) {
		let words = content.split(" ").length;
		let wordsLabel = "word" + (words !== 1 ? "s" : "");
		return `${words} ${wordsLabel}`;
	});

	// Get the first `n` elements of a collection.
	eleventyConfig.addFilter("head", (array, n) => {
		if( n < 0 ) {
			return array.slice(n);
		}
		return array.slice(0, n);
	});

	eleventyConfig.addFilter('localUrl', (absoluteUrl) => {
		return absoluteUrl.replace("https://www.zachleat.com", "");
	});

	const allowedHTML = {
		allowedTags: ['b', 'i', 'em', 'strong', 'a'],
		allowedAttributes: {
			a: ['href']
		}
	};

	eleventyConfig.addLiquidFilter('sanitizeHTML', content => {
		return content ? sanitizeHTML(content, allowedHTML) : "";
	});

	eleventyConfig.addFilter('webmentionIsType', (webmention, type) => {
		return type === webmention['wm-property'];
	});

	eleventyConfig.addFilter('webmentionsForUrl', (webmentions, url, allowedTypes) => {
		if( !allowedTypes ) {
			// all types
			allowedTypes = ['mention-of', 'in-reply-to', 'like-of', 'repost-of', 'bookmark-of'];
		} else {
			allowedTypes = allowedTypes.split(",");
		}

		if(!url || !webmentions.mentions || !webmentions.mentions[url]) {
			return [];
		}

		let knownUrls = {};
		return webmentions.mentions[url]
			.filter(entry => {
				if(!allowedTypes.includes(entry['wm-property'])) {
					return false;
				}

				if(webmentionBlockList.filter(blockedUrl => {
					return `${entry.url}`.startsWith(blockedUrl) || entry.url.indexOf(blockedUrl) > -1
				}).length > 0) {
					return false;
				}
				if(getBaseUrl(entry['wm-target']) !== url) {
					return false;
				}
				// no dupes
				if(entry.url) {
					if(knownUrls[entry.url]) {
						return false;
					}
					knownUrls[entry.url] = true;
				}
				return true;
			}).sort((a, b) => {
				// Show oldest entries first
				let adate = a.published || a['wm-received'];
				let bdate = b.published || a['wm-received'];
				if(bdate < adate) {
					return 1;
				} else if(bdate > adate) {
					return -1;
				}
				return 0;
			});
	});


	eleventyConfig.addLiquidFilter("randomCase", function(content, sentimentValue) {
		if(content && sentimentValue < -0.07 && content.length <= 5000) {
			return randomCase(content);
		}
		return content;
	});

	eleventyConfig.addLiquidFilter("getSentimentValue", function(content) {
		if( process.env.ELEVENTY_PRODUCTION && content ) {
			const tokenizer = new Natural.WordTokenizer();
			return analyze.getSentiment(tokenizer.tokenize(content));
		}

		return 0;
	});

	/* SHORTCODES */
	eleventyConfig.addLiquidShortcode("youtubeEmbed", function(slug, startTime, label) {
		// TODO only load youtube css/js on pages that use it (via this.page)
		return `<div class="fullwidth"><is-land on:visible import="/web/dist/${pkg.version}/lite-yt-embed.js" class="fluid-width-video-wrapper"><lite-youtube videoid="${slug}"${startTime ? ` params="start=${startTime}"` : ""} playlabel="Play${label ? `: ${label}` : ""}" style="background-image:url('https://i.ytimg.com/vi/${slug}/maxresdefault.jpg')">
	<a href="https://youtube.com/watch?v=${slug}" class="lty-playbtn" title="Play Video"><span class="lyt-visually-hidden">Play Video${label ? `: ${label}` : ""}</span></a>
</lite-youtube></is-land></div>`;
	});

	eleventyConfig.addLiquidShortcode("originalPostEmbed", function(url) {
		return `<a href="${url}" class="opengraph-card favicon-optout">${screenshotImageHtmlFullUrl(url)}<span><em class="break" title="${url}">${url}</em></span></a>`;
	});

	/* COLLECTIONS */
	function getPosts(collectionApi) {
		return collectionApi.getFilteredByGlob("./_posts/*").reverse().filter(function(item) {
			return !!item.data.permalink;
		}).filter(function(item) {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				return false;
			}
			return true;
		});
	}

	eleventyConfig.addCollection("posts", function(collection) {
		return getPosts(collection);
	});

	eleventyConfig.addCollection("feedPosts", function(collection) {
		return getPosts(collection).filter(function(item) {
			return !item.data.tags ||
				!item.data.deprecated &&
				item.data.tags.indexOf("draft") === -1;
		});
	});

	function hasTag(post, tag) {
		return "tags" in post.data && post.data.tags && post.data.tags.indexOf(tag) > -1;
	}
	function hasCategory(post, category) {
		return "categories" in post.data && post.data.categories && post.data.categories.indexOf(category) > -1;
	}
	function isWriting(item) {
		return !!item.inputPath.match(/\/_posts\//) &&
				(!hasTag(item, "external") || hasTag(item, "writing") || (item.data.external_url || "").indexOf("filamentgroup.com") > -1) &&
				!hasTag(item, "speaking") &&
				!hasTag(item, "note") &&
				!hasCategory(item, "presentations");
	}
	function isSpeaking(item) {
		return "categories" in item.data &&
			(item.data.categories || []).indexOf("presentations") > -1 || hasTag(item, "speaking");
	}

	eleventyConfig.addLiquidFilter("getFilterCategories", function(collectionItem) {
		let categories = [];
		if(isSpeaking(collectionItem)) {
			categories.push("speaking");
		}
		if(isWriting(collectionItem)) {
			categories.push("writing");
		}
		if(hasTag(collectionItem, "font-loading") || hasCategory(collectionItem, "font-loading")) {
			categories.push("web-fonts");
		}

		let tags = [
			"eleventy",
			"project",
			"note",
			"web-components",
		];
		for(let tag of tags) {
			if(hasTag(collectionItem, tag)) {
				categories.push(tag);
			}
		}
		return categories.join(",");
	});

	eleventyConfig.addCollection("writing", function(collection) {
		return collection.getSortedByDate().reverse().filter(item => {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				return false;
			}

			return isWriting(item);
		});
	});
	eleventyConfig.addCollection("latestPosts", function(collection) {
		let posts = collection.getSortedByDate().reverse();
		let items = [];
		for( let item of posts ) {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				continue;
			}

			if( !!item.inputPath.match(/\/_posts\//)) {
				items.push( item );
				if( items.length >= 5 ) {
					return items;
				}
			}
		}
	});

	// font-loading category mapped to collection
	eleventyConfig.addCollection("font-loading", function(collection) {
		return collection.getAllSorted().filter(function(item) {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				return false;
			}

			return "categories" in item.data && item.data.categories && item.data.categories.indexOf("font-loading") > -1 || hasTag(item, "font-loading");
		}).reverse();
	});

	// presentations category mapped to collection
	eleventyConfig.addCollection("presentations", function(collection) {
		return collection.getAllSorted().filter(function(item) {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				return false;
			}

			return isSpeaking(item);
		}).reverse();
	});

	eleventyConfig.addCollection("popularPostsRanked", function(collection) {
		return collection.getFilteredByGlob("./_posts/*.md").filter(item => {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				return false;
			}
			if(!analyticsData[item.url]) {
				return false;
			}
			return true;
		}).sort(function(a, b) {
			return analyticsData[b.url].rankPerDaysPosted - analyticsData[a.url].rankPerDaysPosted;
		}).reverse().slice(0, 20);
	});

	eleventyConfig.addCollection("popularPostsTotalRanked", function(collection) {
		return collection.getFilteredByGlob("./_posts/*.md").filter(item => {
			if(process.env.ELEVENTY_PRODUCTION && item.data.tags && item.data.tags.includes("draft")) {
				return false;
			}
			if(!analyticsData[item.url]) {
				return false;
			}
			return true;
		}).sort(function(a, b) {
			return analyticsData[b.url].rankTotal - analyticsData[a.url].rankTotal;
		}).reverse().slice(0, 20);
	});

	/* Markdown */
	let options = {
		html: true,
		breaks: true,
		linkify: true
	};

	let md = markdownIt(options).use(markdownItAnchor, {
		permalink: markdownItAnchor.permalink.ariaHidden({
			placement: "after",
			class: "direct-link",
			symbol: "#",
			level: [1,2,3,4],
		}),
		slugify: eleventyConfig.getFilter("slug")
	});

	eleventyConfig.setLibrary("md", md);
	
	eleventyConfig.addPairedShortcode("markdown", function(content, inline = false) {
		if(inline) {
			return md.renderInline(content);
		}
		return md.render(content);
	});

	eleventyConfig.addLiquidFilter("includes", function(arr = [], value) {
		return arr.includes(value);
	});

	eleventyConfig.addLiquidFilter("removeNewlines", function(str) {
		return str.replace(/\n/g, "");
	});

	eleventyConfig.on("beforeWatch", () => {
		console.log( "[zachleat.com] Building…" );
	});

	return {
		"templateFormats": [
			"liquid",
			"md",
			"njk",
			"html"
		],
		"dataTemplateEngine": false,
		"htmlTemplateEngine": "liquid",
		"markdownTemplateEngine": "liquid"
	};
};