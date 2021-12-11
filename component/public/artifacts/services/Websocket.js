Vue.service("websocket", {
	data: function() {
		return {
			socket: null,
			stopped: false,
			backlog: [],
			// a list of functions to call when a new message arrives
			subscribers: [],
			connected: false
		}
	},
	activate: function(done) {
		var id = new Date().toISOString().replace(/[:.-]+/g, "");
		var promise = new nabu.utils.promise();
	
		var self = this;
		var start = function() {
			var url = window.location.protocol == "https:" ? "wss" : "ws";
			url += "://";
			url += window.location.hostname;
			if ((window.location.protocol == "https:" && window.location.port != 443) || (window.location.protocol == "http:" && window.location.port != 80)) {
				url += ":" + window.location.port;
			}
			url += "${server.root()}";
			url += "p/w/" + id;
			self.socket = new WebSocket(url, "data");
			self.socket.onopen = function(event) {
				self.connected = true;
				if (self.backlog.length > 0) {
					self.backlog.splice(0).forEach(function(event) {
						self.socket.send(JSON.stringify(event));
					});
				}
				promise.resolve();
			};
			// if it is remotely closed, we will try again!
			self.socket.onclose = function(event) {
				self.connected = false;
				// don't reconnect if we actually stopped
				if (!self.stopped) {
					setTimeout(start, 2000);
				}
			};
			self.socket.onmessage = function(event) {
				// var data = event.data
				console.log("Received message", event.data);
				var parsed = JSON.parse(event.data);
				self.subscribers.forEach(function(x) {
					x(parsed);
				});
			};
		};
		
		var heartbeat = function() {
			if (self.connected) {
				self.socket.send(JSON.stringify({
					type: "heartbeat",
					content: {
						timestamp: new Date().toISOString()
					}
				}));
			}
			setTimeout(heartbeat, 10000);
		};
		heartbeat();
		start();
		done();
	},
	clear: function(done) {
		// we close the socket without toggling the stopped
		// that means it will attempt to reconnect
		if (this.socket != null) {
			this.socket.close();
		}
		done();
	},
	methods: {
		// we send back an unsubscribe function
		subscribe: function(caller) {
			this.subscribers.push(caller);
			var self = this;
			return function() {
				var index = self.subscribers.indexOf(caller);
				if (index >= 0) {
					self.subscribers.splice(index, 1);
				}
			}
		},
		send: function(type, content) {
			var data = {
				type: type
			};
			if (content) {
				data.content = content;
			}
			if (this.connected) {
				this.socket.send(JSON.stringify(data));	
			}
			else {
				this.backlog.push(data);
			}
		},
		stop: function() {
			this.stopped = true;
			if (this.socket != null) {
				this.socket.close();
			}
		}
	}
});