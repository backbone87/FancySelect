(function($, $$, undef) {
	
	DOMEvent.definePseudo("not", function(split, fn, args) {
		if(split.value && args[0]) {
			var target = $(args[0].target);
			if(target && target.match(split.value) || target.getParent(split.value)) return;
		}
		fn.apply(args);
	});
	
	var TRUE = true,
		contains = function(item) { return this.contains(item); },
		notContains = function(item) { return !this.contains(item); },
		GraphicalSelect = {};
	
	GraphicalSelect.Implements = [ Options, Events, Class.Occlude ];
	GraphicalSelect.Binds = [ "getOption", "open", "close", "toggle", "_select", "_closeNoFocus", "_markNext", "_markPrevious", "_mark" ];
	
	GraphicalSelect.options = {
		legacy: TRUE,
		text: TRUE,
		image: TRUE,
		scroll: TRUE, // TODO
		hide: TRUE,
//		circle: undef,
//		css: undef,
		data: TRUE
	};
	
	GraphicalSelect.initialize = function(element, options, detached) {
		var self = this, occluded = undef;
		
		self.element = element = $(element);
		if(!element || element.get("tag") != "select") return;
		if(self.occlude("graphicalSelect", element)) {
			self = self.occluded;
			occluded = TRUE;
		} else {
			self.id = "gs" + String.uniqueID();
			self.selected = new Elements();
		}
		
		if((!occluded && options == TRUE) || (options && options.data)) {
			self.setOptions(JSON.decode(self.element.get("data-gsOptions")));
		}
		
		self.setOptions(options);
		if(detached || occluded) self.update();
		else self.attach(TRUE);
		
		return self;
	};

	GraphicalSelect.attach = function(update) {
		var self = this;
		if(self.attached) return self;
		self.attached = TRUE;
		
		if(!self.container) {
			self.container = new Element("div.gsContainer")
				.set("id", self.id)
				.addEvent("click:relay(.gsToggler)", self.toggle)
				.addEvent("click:relay(li:not(.gsGroup))", self._select)
				.addEvent("mouseenter:relay(li:not(.gsGroup))", self._mark);
			if(self.options.css) self.container.addClass(self.options.css);
			self.inner = new Element("div.gsInner").inject(self.container);
			self._drawToggler();
		}
		
		self.select(self.element.getSelected(), undef, TRUE);
		
		self.element.addClass("gsReplaced");
		self.container.inject(self.element, "after");
		
//		if (Browser.ie) window.addEvent('load', function() { this.select(this.element.get('value')); }.bind(this)); // IE refresh fix

		if(self.options.hide) document.addEvent("click:not(#" + self.id + ")", self._closeNoFocus);
		document.addEvent("keydown:keys(esc)", self.close);
		self.element.addEvent("focus", self.open);
		self.element.addEvent("keydown:keys(tab)", self.close);
		self.element.addEvent("keydown:keys(up)", self._markPrevious);
		self.element.addEvent("keydown:keys(down)", self._markNext);
		self.element.addEvent("keydown:keys(enter)", self._select);
		return self.fireEvent("attach");
	};

	GraphicalSelect.detach = function() {
		var self = this;
		if(!self.attached) return;
		
		document.removeEvent("click:not(#" + self.id + ")", self._closeNoFocus);
		document.removeEvent("keydown:keys(esc)", self.close);
		self.element.removeEvent("focus", self.open);
		self.element.removeEvent("keydown:keys(tab)", self.close);
		self.element.removeEvent("keydown:keys(up)", self._markPrevious);
		self.element.removeEvent("keydown:keys(down)", self._markNext);
		self.element.removeEvent("keydown:keys(enter)", self._select);
		self.close();
		
		self.container.dispose();
		self.element.removeClass("gsReplaced");

		self.attached = undef;
		
		return self.fireEvent("detach");
	};
	
	// TODO
	GraphicalSelect.update = function(redraw) {
		var self = this;
//		if(!self.attached) return;
//		if(self.opened) drawList(self);
//		drawSelection(self);
		return self;
	};
	
	GraphicalSelect.getOption = function(value) {
		var self = this, tag;
		if(typeof value == "string") {
			return self.element.getElement('option[value="' + value + '"]');
		}
		
		value = $(value);
		if(!value) return;
		
		tag = value.get("tag");
		if(tag == "option") {
			return value.getParents().contains(self.element) ? value : undef;
		}
		
		if(!self.list) return;
		
		if(tag != "li") {
			value = value.getParent("li");
			if(!value) return;
		}
		
		value = value.retrieve("gsOption");
		return value && value.getParents().contains(self.element) ? value : undef;
	};
	
	GraphicalSelect.select = function(selected, mode, silent) {
		var self = this, i, j, item;
		if(!self.attached) return self;
		
		selected = Array.from(selected);
		if(!self.multiple) selected.length = 1;
		selected = selected.map(self.getOption).clean();

		if(self.multiple) {
			if(mode == "deselect") {
				if(!selected.length) return self;
				selected = self.selected.filter(notContains, selected);
				
			} else if(mode == "invert") {
				if(!selected.length) return self;
				for(i = 0; i < self.selected.length; i++) {
					item = self.selected[i];
					for(j = 0; j < selected.length; j++) if(selected[j] == item) {
						selected.splice(j, 1);
						item = undef;
						break;
					}
					if(item) selected.push(item);
				}
				
			} else if(mode == "add") {
				if(!selected.length) return self;
				selected.combine(self.selected);
			}
			
			if(self.selected.length == selected.length
			&& !self.selected.filter(contains, selected).length) {
				return self;
			}
			
		} else if(!selected.length || selected[0] == self.selected[0]) {
			return self;
		}
		
		selected = new Elements(selected);
		self._drawSelection(selected);
		self.selected.set("selected", undef);
		self.selected = selected;
		self.selected.set("selected", TRUE);
		
		if(!silent && self.options.legacy) {
			self.element.fireEvent("change").getParents().fireEvent("change");
		}
		
		return self;
	};

	GraphicalSelect.open = function(nofocus) {
		var self = this;
		if(self.attached && !self.opened) {
			if(!self.list) self._drawList();
			if(!nofocus) self.element.focus();
			if(self.marked) {
				self.marked.removeClass("gsMarked");
				self.marked = undef;
			}
			self.container.addClass("gsOpen");
			if(self.selected.length) {
				self.marked = self.selected[0].retrieve("gsItem").addClass("gsMarked");
				self._scrollToItem(self.marked);
			}
			self.opened = TRUE;
			self.fireEvent("open");
		}
		return self;
	};
	
	GraphicalSelect.close = function(nofocus) {
		var self = this;
		if(self.attached && self.opened) {
			if(!nofocus) self.element.focus();
			self.container.removeClass("gsOpen");
			self.opened = undef;
			self.fireEvent("close");
		}
		return self;
	};
	
	GraphicalSelect.toggle = function() {
		return this[this.opened ? "close" : "open"]();
	};
	
	GraphicalSelect._select = function(event, target) {
		if(!target) target = this.marked;
		if(!target) return;
		this.select(target);
		this.close();
		event.preventDefault();
	};
	
	GraphicalSelect._closeNoFocus = function() {
		this.close(TRUE);
	};
	
	GraphicalSelect._getFirst = function(group) {
		if(group) return group.getElement("li:not(.gsGroup)");
	};
	
	GraphicalSelect._getLast = function(group) {
		if(group) {
			var last = group.getLast("li");
			while(last) {
				if(!last.match(".gsGroup")) return last;
				group = last;
				last = this._getLast(group);
				if(last) return last;
				last = group.getPrevious("li");
			}
		}
	};
	
	GraphicalSelect._getNext = function(item) {
		if(item) do {
			var next = item.getNext("li");
			if(!next) {
				item = item.getParent("li.gsGroup");
			} else {
				if(next.match(".gsGroup")) next = this._getFirst(item = next);
				if(next) return next;
			}
		} while(item);
	};
	
	GraphicalSelect._getPrevious = function(item) {
		if(item) do {
			var previous = item.getPrevious("li");
			if(!previous) {
				item = item.getParent("li.gsGroup");
			} else {
				if(previous.match(".gsGroup")) previous = this._getLast(item = previous);
				if(previous) return previous;
			}
		} while(item);
	};
	
	GraphicalSelect._markNext = function() {
		var self = this, next = self._getNext(self.marked);
		if(!next && self.options.circle) next = self._getFirst(self.list);
		if(next) self._mark(undef, next);
	};
	
	GraphicalSelect._markPrevious = function() {
		var self = this, previous = self._getPrevious(self.marked);
		if(!previous && self.options.circle) previous = self._getLast(self.list);
		if(previous) self._mark(undef, previous);
	};
	
	GraphicalSelect._mark = function(event, target) {
		var self = this;
		if(self.marked) self.marked.removeClass("gsMarked");
		self.marked = target.addClass("gsMarked");
		self._scrollToItem(self.marked);
	};
	
	GraphicalSelect._scrollToItem = function(item) {
		var self = this, target = item.getPosition(self.list), current = self.list.getScroll(), size;
		if(target.y < 0) return self.list.scrollTo(current.x, current.y + target.y);
		target.y += item.getSize().y;
		size = self.list.getSize();
		if(target.y > size.y) self.list.scrollTo(current.x, current.y + target.y - size.y);
	};
	
	GraphicalSelect._drawSelection = function(selected) {
		var self = this;
		self.selection.empty();
		if(selected[0]) self._drawLabel(selected[0], self.selection);
	};
		
	GraphicalSelect._drawToggler = function() {
		var self = this, toggler = self.toggler;
		if(toggler) toggler.destroy();
		self.toggler = toggler = new Element("div.gsToggler").inject(self.inner);
		self.selection = new Element("div.gsSelection").inject(toggler);
		new Element("div.gsArrow").inject(toggler);
	};
	
	GraphicalSelect._drawList = function() {
		var self = this, list = self.list;
		if(list) list.destroy();
		self.list = list = new Element("ul.gsList").inject(self.inner);
		self._parseOptions(self.element, list);
	};

	GraphicalSelect._parseOptions = function(element, container) {
		var children = element.getChildren(), tag, i;
		for(i = 0; i < children.length; i++) {
			element = $(children[i]);
			tag = element.get("tag");
			if(tag == "option") this._drawOption(element, container);
			else if(tag == "optgroup") this._drawOptgroup(element, container);
		}
	};
	
	GraphicalSelect._drawOptgroup = function(element, container) {
		var self = this;
		if(self.options.group) {
			container = new Element("li.gsGroup").inject(container);
			container = new Element("div.gsLabel").inject(container);
			self._drawLabel(element, container);
			container = new Element("ul").inject(container, "after");
		}
		self._parseOptions(element, container);
	};
	
	GraphicalSelect._drawOption = function(element, container) {
		var self = this;
		container = new Element("li").inject(container);
		container.set("data-value", element.get("value")).store("gsOption", element);
		element.store("gsItem", container);
		self._drawLabel(element, container);
		if(element.get("disabled")) container.addClass("gsDisabled");
	};
	
	GraphicalSelect._drawLabel = function(element, container) {
		var self = this, image = undef, html = undef;
		if(self.options.image) {
			image = element.get("data-image");
			if(image) image = new Element("img.gsImage").set("src", image).set("alt", element.get("data-alt"));
		}
		if(self.options.text || !image) {
			if(self.options.html) html = element.get("data-html");
			if(html) container.set("html", html);
			else new Element("span.gsText").set("text", element.get("text")).inject(container);
		}
		if(image) image.inject(container, self.options.image == "bottom" ? "bottom" : "top");
	};
	
	if(!window.bbit) bbit = {};
	if(!bbit.mt) bbit.mt = {};
	bbit.mt.GraphicalSelect = GraphicalSelect = new Class(GraphicalSelect);
	
	Element.implement("graphicalSelect", function(options, detached) {
		return new GraphicalSelect(this, options == undef ? TRUE : options, detached);
	});
	
	GraphicalSelect.auto = function() { $$("select.GraphicalSelect").graphicalSelect(); };
	
	window.addEvent("domready", GraphicalSelect.auto);
	
})(document.id, window.$$);