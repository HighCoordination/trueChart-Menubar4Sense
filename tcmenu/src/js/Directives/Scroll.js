import * as $ from 'jquery';
import * as qvangular from 'qvangular';
import {angular, $compile, $timeout} from '../Services/AngularService';

new function(){
	return qvangular.directive('scrollable', function(){
		return {
			restrict: 'A',
			controller: ['$scope','$element', function(scope, element){

				if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
					return;
				}
				var ownScroll = false;
				var fadeTimeout;
				var watchers = [];

				scope.draggableHeight = 10;
				scope.draggableStyle =
					{
						position: 'relative',
						height: scope.draggableHeight+'%',
						background: 'rgba(50, 50, 50, 0.0)',
						borderRadius: '3px',
						zIndex: 1006,
						visibility: 'visible'
					};

				scope.railStyle =
					{
						position: 'absolute',
						top: '0',
						right: '3px',
						height: '100%',
						width: '7px',
						zIndex: 1005,
						visibility: 'hidden'
					};
				scope.mouseOnDrag = false;
				scope.isOnElement = false;
				scope.mouseDown = false;


				var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
					var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
					return v.toString(16);
				});
				qvangular.$rootScope.tcmenuCurrentScroll = undefined;
				qvangular.$rootScope.tcmenuIsDrag = false;
				qvangular.$rootScope.tcmenuNoScroll = true;


				scope.rail = $compile(angular.element('<div class="hico-scroll-rail" ng-style="railStyle"><div class="hico-scroll-dragger"'
													 + ' ng-style="draggableStyle"></div></div>'))(scope);

				scope.draggable = scope.rail.find('.hico-scroll-dragger');
				element.parent().append(scope.rail);

				element.scrollTop(0);

				if((scope.rail[0].clientHeight * 100) / element[0].scrollHeight >= 98){
					scope.draggableStyle.height = 0;
				}else if((scope.rail[0].clientHeight * 100) / element[0].scrollHeight >= scope.draggableHeight){
					scope.draggableStyle.height = (scope.rail[0].clientHeight * 100) / element[0].scrollHeight + '%';
				}



				watchers.push(scope.$watch(function() { return qvangular.$rootScope.tcmenuNoScroll }, function(newVal, oldVal) {
					if(newVal !== oldVal){
						if(!qvangular.$rootScope.tcmenuNoScroll){
							scope.draggableStyle.visibility = 'hidden';
						}else if(!scope.leave){
							scope.draggableStyle.background = 'rgba(50, 50, 50, 0.3)';
							scope.draggableStyle.visibility = 'visible';
						}else{
							scope.leave = false;
						}
					}

				}));

				watchers.push(scope.$watch(function() { return qvangular.$rootScope.tcmenuCurrentScroll }, function() {
					if(guid === qvangular.$rootScope.tcmenuCurrentScroll){
						scope.draggable.css({'top': scope.calcDragPosition(), 'left' : 0});
						scope.draggableStyle.visibility = 'visible';
					}else{
						scope.draggableStyle.visibility = 'hidden';
					}
				}));

				scope.calcDragPosition = function(){
					var scrollpercent = Math.round((element[0].scrollTop * 100) / (element[0].scrollHeight - element[0].clientHeight));

					return (((this.rail[0].scrollHeight) - this.draggable[0].clientHeight)  * scrollpercent) / 100;
				};

				scope.draggable.draggable(
					{
						axis: "y",
						containment: scope.rail,
						scroll: false,
						drag: function(){
							if(qvangular.$rootScope.tcmenuNoScroll){
								qvangular.$rootScope.tcmenuIsDrag = true;
								var offset = $(this).position();
								var yPos = offset.top;

								var dragpercent = Math.round((yPos * 100) / (scope.rail[0].clientHeight - scope.draggable[0].clientHeight));
								element.scrollTop(((element[0].scrollHeight - element[0].clientHeight)  * dragpercent) / 100);
							}
						},
						stop: function(){
							qvangular.$rootScope.tcmenuIsDrag = false;

							if(!scope.mouseOnDrag){
								scope.draggableStyle.background = 'rgba(50, 50, 50, 0.3)';
							}

							if(!qvangular.$rootScope.tcmenuIsDrag && !scope.isOnElement && scope.mouseDown){
								setTimeoutFunction();
								scope.mouseDown = false;
							}
						}
					});

				element.parent().on('wheel', function(event){
					if(qvangular.$rootScope.tcmenuNoScroll){
						if (event.originalEvent.deltaY < 0) {
							element.scrollTop(element[0].scrollTop - 50);
						}
						else {
							element.scrollTop(element[0].scrollTop + 50);
						}
						scope.draggable.css({'top': scope.calcDragPosition(), 'left' : 0});
					}

					if(element.closest('.hico-select-panel').length > 0){
						return false;
					}
				});

				element.on('mouseover', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.isOnElement = true;

						if(!qvangular.$rootScope.tcmenuIsDrag){
							qvangular.$rootScope.tcmenuCurrentScroll = guid;
							stopTimeout();
							scope.draggableStyle.visibility = 'visible';
							scope.draggable.stop().fadeIn('fast');
						}

						$timeout(function() {
							if(element){
								if((scope.rail[0].clientHeight * 100) / element[0].scrollHeight >= 98){
									scope.draggableStyle.height = 0;
								}else if((scope.rail[0].clientHeight * 100) / element[0].scrollHeight >= scope.draggableHeight){
									scope.draggableStyle.height = (scope.rail[0].clientHeight * 100) / element[0].scrollHeight + '%';
								}
							}
						});

					}

					if(scope.menuOpen || (scope.parentscope && scope.parentscope.menuOpen)){
						return false;
					}
				});

				element.parent().on('mouseover', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						if(!qvangular.$rootScope.tcmenuIsDrag){
							qvangular.$rootScope.tcmenuCurrentScroll = guid;
						}
					}

					if(scope.menuOpen || (scope.parentscope && scope.parentscope.menuOpen)){
						return false;
					}
				});

				element.on('mouseenter', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						if(!qvangular.$rootScope.tcmenuIsDrag){
							scope.draggableStyle.background = 'rgba(50, 50, 50, 0.3)';
						}
					}

					if(scope.menuOpen || (scope.parentscope && scope.parentscope.menuOpen)){
						return false;
					}
				});


				element.parent().on('mouseleave', function(){
					scope.leave = true;
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.isOnElement = false;

						if(!qvangular.$rootScope.tcmenuIsDrag){
							//fade out dragger
							setTimeoutFunction();
							scope.isScroll = false;
							ownScroll = false;
						}
					}

					return true;
				});

				scope.draggable.on('mouseenter', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.mouseOnDrag = true;

						scope.draggableStyle.background = 'rgba(50, 50, 50, 0.6)';
					}

				});

				scope.draggable.on('mousemove', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.mouseOnDrag = true;

						$timeout(function() {
							scope.draggableStyle.background = 'rgba(50, 50, 50, 0.6)';
						});
					}

				});

				scope.draggable.on('mouseleave', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.mouseOnDrag = false;
						if(!qvangular.$rootScope.tcmenuIsDrag){
							scope.draggableStyle.background = 'rgba(50, 50, 50, 0.3)';
						}
					}

				});

				scope.draggable.on('mouseup', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.mouseDown = false;
						scope.draggableStyle.background = 'rgba(50, 50, 50, 0.3)';
					}

				});

				scope.draggable.on('mousedown', function(){
					if(qvangular.$rootScope.tcmenuNoScroll){
						scope.mouseDown = true;
						scope.draggableStyle.background = 'rgba(50, 50, 50, 0.6)';
					}

				});

				// Cleanup when scorollbar is removed from dom
				element.on('$destroy', onDestroy);

				function setTimeoutFunction(){
					fadeTimeout = setTimeout(function(){
						if(scope.draggable){
							scope.draggable  && scope.draggable.stop().fadeOut(500);
							scope.draggableStyle.visibility = 'visible';
						}
					}, 500);
				}

				function stopTimeout() {
					clearTimeout(fadeTimeout);
				}

				function onDestroy(){
					const scope = angular.element(this).scope();

					if(scope){
						// Remove references
						scope.rail = null;
						scope.draggable = null;
					}

					// unwatch watchers
					watchers.forEach(function(unwatch){
						unwatch();
					});
				}
			}]
		};
	});
};