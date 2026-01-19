# micro-backend/app.py
import os
import time
import base64
from PIL import Image
from io import BytesIO
from flask_cors import CORS
from flask import Flask, request, jsonify, send_file





'''
>>> Definición de constantes
'''
app = Flask(__name__)
CORS(app)

# Carpeta para guardar las firmas temporalmente
UPLOAD_FOLDER = 'signatures'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)





'''
>>> Endpoints
'''
@app.route('/api/save-signature', methods=['POST'])
def save_signature():
    try:
        data = request.get_json()
        
        if not data or 'signature' not in data:
            return jsonify({'error': 'No signature data provided'}), 400
        
        signature_base64 = data['signature']
        
        # Decodificar base64 a bytes
        image_data = base64.b64decode(signature_base64)
        
        # Crear imagen desde bytes
        image = Image.open(BytesIO(image_data))
        
        # Convertir a RGBA para mantener transparencia
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
        
        # Redimensionar solo si es necesario usando Lanczos de alta calidad
        if image.size != (400, 100):
            image = image.resize((400, 100), Image.Resampling.LANCZOS)
        
        # Crear buffer en memoria para PNG
        output_buffer = BytesIO()
        
        # Guardar con máxima calidad PNG sin compresión
        image.save(
            output_buffer,
            format = 'PNG',
            compress_level = 0,
            optimize = False
        )
        
        # Posicionar al inicio del buffer
        output_buffer.seek(0)
        
        # Generar nombre único
        timestamp = int(time.time() * 1000)
        filename = f'signature_{timestamp}.png'
        
        return send_file(
            output_buffer,
            mimetype = 'image/png',
            as_attachment = True,
            download_name = filename
        )
    except Exception as e:
        print(f'Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'message': 'Signature API is running'
    }), 200





if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)