const cb = new Codebird;
let firstList;

window.onload = function get_body() {
	firstList = document.getElementById("root");
	const url = new URL(window.location);
	const params = new URLSearchParams(url.search);
	const originalTweetId = params.get("tweetID");
	let parentTweet = createTweet(originalTweetId);
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
	cb.__call(
			"statuses_show_ID",
			"id=" + parentTweet.id,
			function (reply) {
				recursiveSearch(parentTweet, reply.user.screen_name, reply.id_str);
			},
			true //app_only_auth
	);
	// recursiveReplySearch(parentTweet).then(([parentTweet, screenName, sinceId]) => {
	// 	recursiveSearch(parentTweet, screenName, sinceId);
	// });
};

function recursiveReplySearch(tweet) {
	return new Promise((resolve) => {
		cb.__call(
				"statuses_show_ID",
				"id=" + tweet.id,
				function (reply) {
					resolve([tweet, reply.user.screen_name, reply.id_str]);
					if (reply.in_reply_to_status_id_str) {
						let newFirstTweet = createTweet(reply.in_reply_to_status_id_str);
						let ulElement = document.createElement("ul");
						newFirstTweet.parentElement.appendChild(ulElement);
						ulElement.appendChild(tweet.parentElement);
						recursiveReplySearch(newFirstTweet);
					}
				},
				true //app_only_auth
		);
	});
}

function recursiveSearch(parentTweet, screenName, sinceId, maxId) {
	let params = {q: "(to:" + screenName + ")", since_id: sinceId, count: 100};
	if (maxId) {
		params.max_id = maxId;
	}

	cb.__call(
			"search_tweets",
			params,
			function (reply) {
				for (let tweet of reply.statuses) {
					if (tweet.in_reply_to_status_id_str === parentTweet.id) {
						const newTweet = createTweet(tweet.id_str, parentTweet);
						recursiveSearch(newTweet, tweet.user.screen_name, tweet.id_str)
					}
				}
				if (reply.search_metadata.next_results) {
					const newMaxId = reply.search_metadata.next_results.substring(
							reply.search_metadata.next_results.lastIndexOf("max_id=") + 7,
							reply.search_metadata.next_results.lastIndexOf("&q="));
					recursiveSearch(parentTweet, screenName, sinceId, newMaxId);
				}
			},
			true //app_only_auth
	);
}

function createTweet(tweetId, parentTweet) {
	let ulElement;
	let tweet = document.createElement("div");
	if (!parentTweet) {
		ulElement = firstList;
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
	tweet.id = tweetId;
	tweet.className = "child";
	root.appendChild(tweet);
	twttr.widgets.createTweet(
			tweetId, tweet,
			{
				conversation: "none",    // or all
				linkColor: "#cc0000", // default is blue
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

function showTweet(tweet) {
	tweet.style.display = "inline-block";
}

function hideTweet(tweet) {
	tweet.style.display = "none";
}