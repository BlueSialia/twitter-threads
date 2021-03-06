const cb = new Codebird;
let tweetRoot;

class Tweet {
	constructor(tweetID, parent, children) {
		this.tweetID = tweetID;
		this.parent = parent;
		this.children = children || [];
	}
}

function init() {
	getUrlParams();
	tweetRoot = new Tweet(document.getElementById("tweetID").value);
	setCredentials();
}

function recursiveReplySearch(in_reply_to_status_id_str) {
	tweetRoot = new Tweet(in_reply_to_status_id_str, undefined, [tweetRoot]);
	return new Promise((resolve, reject) => {
		cb.__call(
				"statuses_show_ID",
				"id=" + tweetRoot.tweetID,
				null, //use promises instead of callbacks
				true //app_only_auth
		).then((response) => {
			try {
				if (response.reply.in_reply_to_status_id_str) {
					recursiveReplySearch(response.reply.in_reply_to_status_id_str).then(resolve).catch(reject);
				} else {
					resolve();
				}
			} catch (e) {
				reject()
			}
		});
	});
}

function recursiveSearch(parentTweet, screenName, sinceId, maxId) {
	return new Promise((resolve, reject) => {
		let params = {q: "(to:" + screenName + ")", since_id: sinceId, count: 100};
		if (maxId) {
			params.max_id = maxId;
		}

		cb.__call(
				"search_tweets",
				params,
				null, //use promises instead of callbacks
				true //app_only_auth
		).then((response) => {
			try {
				let promises = [];
				for (let tweet of response.reply.statuses) {
					if (tweet.in_reply_to_status_id_str === parentTweet.tweetID) {
						let newTweet = new Tweet(tweet.id_str, parentTweet);
						parentTweet.children.push(newTweet);
						promises.push(recursiveSearch(newTweet, tweet.user.screen_name, tweet.id_str));
					}
				}
				if (response.reply.search_metadata.next_results) {
					const newMaxId = response.reply.search_metadata.next_results.substring(
							response.reply.search_metadata.next_results.lastIndexOf("max_id=") + 7,
							response.reply.search_metadata.next_results.lastIndexOf("&q="));
					promises.push(recursiveSearch(parentTweet, screenName, sinceId, newMaxId));
				}
				Promise.all(promises).then(resolve).catch(reject);
			} catch (e) {
				reject();
			}
		});
	});
}

function createTweet(tweetID, parentTweet) {
	let ulElement;
	let tweet = document.createElement("div");
	if (!parentTweet) {
		ulElement = document.getElementById("root");
	} else {
		for (let child of parentTweet.parentElement.children) {
			if (child.tagName === "UL") {
				ulElement = child;
			}
		}
		if (!ulElement) {
			ulElement = document.createElement("ul");
			parentTweet.parentElement.appendChild(ulElement);
		}
	}
	let root = document.createElement("li");
	ulElement.appendChild(root);
	tweet.id = tweetID;
	tweet.className = "child";
	root.appendChild(tweet);
	twttr.widgets.createTweet(
			tweetID, tweet,
			{
				conversation: "none",    // or all
			});
	let button = document.createElement("button");
	button.textContent = "X";
	button.onclick = function () {
		if (tweet.parentElement.parentElement.childElementCount > 1) {
			tweet.parentElement.parentElement.removeChild(tweet.parentElement);
		} else {
			tweet.parentElement.parentElement.parentElement.removeChild(tweet.parentElement.parentElement);
		}
	};
	tweet.appendChild(button);
	return tweet;
}

function renderTweets(tweet, DOMTweet) {
	for (let child of tweet.children) {
		if (!document.getElementById("removeChildless").checked || tweet.children.length < 5 || child.children.length > 0) {
			renderTweets(child, createTweet(child.tweetID, DOMTweet));
		}
	}
}

window.onload = () => {
	init();
	cb.__call(
			"statuses_show_ID",
			"id=" + tweetRoot.tweetID,
			null, //use promises instead of callbacks
			true //app_only_auth
	).then((response) => {
		let promises = [];
		const auxDate = new Date(response.reply.created_at);
		auxDate.setDate(new Date(response.reply.created_at).getDate() + 5);
		if (auxDate > new Date()) {
			promises.push(recursiveSearch(tweetRoot, response.reply.user.screen_name, response.reply.id_str));
			if (document.getElementById("showParents").checked && response.reply.in_reply_to_status_id_str) {
				promises.push(recursiveReplySearch(response.reply.in_reply_to_status_id_str));
			}
		} else {
			document.getElementById("root").removeChild(document.getElementById("loading"));
			const error = document.createElement("span");
			error.textContent = "This app only accepts tweets less than 5 days old because of Twitter API limitations";
			document.getElementById("root").appendChild(error);
		}
		return Promise.all(promises);
	}).always(() => {
		document.getElementById("root").removeChild(document.getElementById("loading"));
		renderTweets(tweetRoot, createTweet(tweetRoot.tweetID));
	});
};

function getUrlParams() {
	const url = new URL(window.location);
	const params = new URLSearchParams(url.search);
	document.getElementById("tweetID").value = params.get("tweetID");
	document.getElementById("showParents").checked = params.get("showParents") === "true";
	document.getElementById("removeChildless").checked = params.get("removeChildless") === "true";
}

function setCredentials() {
	cb.setConsumerKey("mQKJucq6cfFRFifuRCIspMiYk", "kciZwLlq9tIBSRkSKMCJjA0VqKM2X1q8AMYiolNOTFpECZ7164");
	if (!localStorage.getItem("bearer_token")) {
		cb.__call("oauth2_token", {}, function (reply) {
			if (reply) {
				localStorage.setItem("bearer_token", reply.access_token);
			}
		});
	} else {
		cb.setBearerToken(localStorage.getItem("bearer_token"));
	}
}

function go() {
	window.location = "?tweetID=" + document.getElementById("tweetID").value +
			"&showParents=" + document.getElementById("showParents").checked +
			"&removeChildless=" + document.getElementById("removeChildless").checked;
	return false;
}