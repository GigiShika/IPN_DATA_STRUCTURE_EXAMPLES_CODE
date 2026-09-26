/* BOOTSTRAP — composición: se arma el grafo de objetos y arranca la app. */
const vm = new AppViewModel(
  new ProgressModel(localStorage),
  new CodeRepository(localStorage),
  new ExecutionService()
);
new StatsView(vm);
new MapView(vm);
new ExerciseView(vm);
vm.bus.emit('navigate', {view:'map'});
