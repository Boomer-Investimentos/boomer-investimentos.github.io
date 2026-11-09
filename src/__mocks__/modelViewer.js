// Mock do @google/model-viewer para os testes (Jest/CRA).
// O import real é apenas side-effect: registra o custom element <model-viewer>,
// cujo bundle é ESM e o Jest do react-scripts não transpila dentro de node_modules.
// Nos testes não precisamos do visualizador 3D, então um módulo vazio basta.
module.exports = {};
