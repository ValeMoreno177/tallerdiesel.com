import { useNavigate } from "react-router-dom";

export default function Credito() {
  return (
    <div className="p-8">
      <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
        <div className="text-6xl mb-4">🚧</div>

        <h1 className="text-3xl font-bold mb-3">
          Módulo de Crédito
        </h1>

        <p className="text-gray-600">
          Esta funcionalidad aún no está disponible.
        </p>

        <p className="text-gray-500 mt-2">
          El módulo de gestión de créditos será implementado en una próxima actualización del sistema.
        </p>
      </div>
    </div>
  );
}