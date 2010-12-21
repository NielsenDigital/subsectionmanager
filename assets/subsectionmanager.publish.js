
(function($) {
	
	/**
	 * This plugin add an interface for subsection management.
	 *
	 * @author: Nils Hörrmann, post@nilshoerrmann.de
	 * @source: http://github.com/nilshoerrmann/subsectionmanager
	 */
	$(document).ready(function() {

		// Language strings
		Symphony.Language.add({
			'There are no selected items': false,
			'Are you sure you want to delete {$item}? It will be removed from all entries. This step cannot be undone.': false,
			'There are currently no items available. Perhaps you want create one first?': false,
			'Remove Item': false,
			'New item': false			
		}); 

		// Initialize Subsection Manager
		$('div.field-subsectionmanager').each(function() {
			var manager = $(this),
				storage = manager.find('select'),
				stage = manager.find('div.stage'),
				selection = stage.find('ul.selection'),
				queue = stage.find('div.queue'),
				queue_loaded = false,
				drawer = stage.data('templates.stage').templates.filter('.drawer').removeClass('template'),
				context = manager.find('input[name*=subsection_id]'),
				subsection = context.val(),
				subsectionmanager_id = context.attr('name').match(/\[subsection_id\]\[(.*)\]/)[1],
				subsection_link = drawer.find('iframe').attr('target');
					
		/*-----------------------------------------------------------------------*/

			// Constructing
			stage.bind('constructstop', function(event, item) {
				
				// New item
				if(item.is('.new')) {
					create(item);
				}
			});
			
			// Destructing
			stage.bind('destructstart', function(event, item) {
			
				// Hide drawer
				item.next('li.drawer').slideUp('fast', function() {
					$(this).remove();
				})
			});
			
			// Synchronizing
			stage.bind('constructstop destructstop update', function(event) {
				sync();
			})
			
			// Editing
			selection.delegate('li:not(.new, .drawer, .empty)', 'click', function(event) {
				var item = $(this),
					editor = item.next('.drawer');
				
				// Don't open editor for item that will be removed
				if(event.srcElement != undefined) {
					if(event.srcElement.className == 'destructor') return;
				}
			
				// Open editor
				if(editor.size() == 0) {
					item.addClass('active');
					edit(item);
				}
				
				// Close editor
				else {
					item.removeClass('active');
					editor.slideUp('fast', function() {
						$(this).remove();
					});
				}
			});
			
			// Updating
			stage.bind('edit', function(event, item, iframe) {
				var id = iframe.contents().find('form').attr('action').match(/\d+/g);

				// Fetch item id
				if($.isArray(id)) {
					id = id[id.length - 1];
				}

				// Update item
				update(id, item, iframe);
			});
					
			// Searching
			stage.bind('browsestart', function(event) {
				browse();
			});
			
			// Deleting
			stage.bind('erase', function(event, item) {
				erase(item);
			});
					
		/*-----------------------------------------------------------------------*/

			// Load subsection
			var load = function(item, editor, iframe) {
				var content = iframe.contents();

				// Adjust interface
				content.find('body').addClass('inline subsection');
				content.find('h1, h2, #nav, #usr, #notice:not(.error):not(.success), #notice a').remove();
				content.find('fieldset input:first').focus();
			
				// Delete item
				if(item.is('.delete')) {
					
					// Remove queue item
					queue.find('li[data-value="' + item.attr('data-value') + '"]').slideUp('fast', function() {
						$(this).remove();
					});
					
					// Remove item
					item.trigger('destruct');
					
					stage.trigger('deletestop', [item]);
				}
				
				// Edit item
				else {			
				
					// Set height
					var height = content.find('form').outerHeight();
					iframe.height(height).animate({
						opacity: 1
					}, 'fast');
					editor.animate({
						height: height
					}, 'fast');
					
					// Handle inline image preview
					if(content.find('body > img').width() > iframe.width()) {
					  content.find('body > img').css({
						'width': iframe.width()
					  });
					}
								
					// Fetch saving
					content.find('div.actions input').click(function() {
						iframe.animate({
							opacity: 0.01
						}, 'fast');
					})
					
					// Trigger update 
					if(content.find('#notice.success').size() > 0) {
						stage.trigger('edit', [item, iframe]);
					}
	
					// Trigger delete
					content.find('button.confirm').click(function(event) {
						event.stopPropagation();
						
						var message = Symphony.Language.get('Are you sure you want to delete {$item}? It will be removed from all entries. This step cannot be undone.', { 
							'item': item.find('span:first').text()
						});
						
						// Prepare deletion
						if(confirm(message)) {
							stage.trigger('deletestart', [item]);
							item.addClass('delete');
							
							// Hide iframe
							iframe.animate({
								opacity: 0.01
							}, 'fast');

							// Delete item
							return true;
						}
						
						// Stop deletion
						else {
							return false;
						}
					});
				}
			};
			
			// Browse queue
			var browse = function() {

				// Append queue if it's not present yet
				if(queue_loaded == false) {
					var list = queue.find('ul').addClass('loading').slideDown('fast');

					// Get queue items
					$.ajax({
						async: false,
						type: 'GET',
						dataType: 'html',
						url: Symphony.Context.get('root') + '/symphony/extension/subsectionmanager/get/',
						data: { 
							id: subsectionmanager_id, 
							section: subsection 
						},
						success: function(result) {

							// Empty queue
							if(!result) {
								$('<li class="message"><span>' + Symphony.Language.get('There are currently no items available. Perhaps you want create one first?') + '</li>').appendTo(list);
							}
							
							// Append queue items
							else {
								$(result).hide().appendTo(list);
								
								// Highlight selected items
								stage.trigger('update');
							}

							// Slide queue
							list.find('li').slideDown('fast', function() {
								$(this).parent('ul').removeClass('loading');
							});
							
							// Save status
							queue_loaded = true;
						}
					});
				}
			};
			
			// Create item
			var create = function(item) {
				stage.trigger('createstart', [item]);

				var editor = drawer.clone().hide().addClass('new');
				
				// Prepare iframe
				editor.find('iframe').css('opacity', '0.01').attr('src', subsection_link + '/new/').load(function() {
					iframe = $(this);
					load(item, editor, iframe);
				});
				
				// Show subsection editor
				editor.insertAfter(item).slideDown('fast');			

				stage.trigger('createstop', [item]);
			};
			
					
			// Edit item
			var edit = function(item) {
				stage.trigger('editstart', [item]);
							
				var editor = drawer.clone().hide();
				
				// Prepare iframe
				editor.find('iframe').css('opacity', '0.01').attr('src', subsection_link + '/edit/' + item.attr('data-value') + '/').load(function() {
					iframe = $(this);
					load(item, editor, iframe);
				});

				// Show subsection editor
				editor.insertAfter(item).slideDown('fast');			
		
				stage.trigger('editstop', [item]);
			};

			// Update item
			var update = function(id, item, iframe) {
				item.addClass('updating');
							
				// Load item data
				$.ajax({
					type: 'GET',
					url: Symphony.Context.get('root') + '/symphony/extension/subsectionmanager/get/',
					data: { 
						id: subsectionmanager_id, 
						section: subsection,
						entry: id
					},
					dataType: 'html',
					success: function(result) {
						var result = $(result),
							destructor = item.find('a.destructor').clone();

						// Get queue item
						var queue_item = queue.find('li[data-value="' + item.attr('data-value') + '"]');
						
						// New item
						if(queue_item.size() == 0) {
						
							// Update queue
							stage.find('div.queue ul').prepend(result.clone());
							
							// Update selected item
							item.children(':not(.destructor)').fadeOut('fast', function() {
								$(this).remove();
								result.children().hide().prependTo(item);
								item.attr('class', result.attr('class')).attr('data-value', result.attr('data-value')).children().fadeIn();
								stage.trigger('update');
							});
						}
						
						// Existing item
						else {
							queue_item.html(result.html());
							item.html(result.html()).attr('class', result.attr('class')).attr('data-value', result.attr('data-value')).append(destructor);
							stage.trigger('update');
						}				
					}
				});
			};
			
			// Synchronize lists
			var sync = function() {
				var stock = storage.find('option').removeAttr('selected');
								
				selection.find('li').not('.drawer').not('.new').not('empty').each(function(index, item) {
					var item = $(item),
						id = item.attr('data-value'),
						stored = stock.filter('[value="' + id + '"]');

					// Existing item
					if(stored.size() == 1) {
						stored.attr('selected', 'selected');
					}
					
					// New item
					else {
						$('<option />').attr('selected', true).attr('value', id).text(Symphony.Language.get('New item') + ' ' + id).appendTo(storage);
					}
				});
				
				// Activate Storage
				storage.removeAttr('disabled');
			}
			
		});

	});
	
})(jQuery.noConflict());
