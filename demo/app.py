from flask import Flask
from flask import render_template
from flask import make_response
from flask import send_file
app = Flask(__name__, static_url_path = '/static')

@app.route('/')
@app.route('/<page>.html')
def route(page='test1'):
    return render_template('%s.html' % page)

@app.route('/static/<path:filepath>.js')
def js(filepath):
    response = make_response(send_file('static/%s.js' % filepath))
    response.mimetype = 'text/javascript'
    return response

if __name__ == '__main__':
    app.debug = True
    app.run(host='0.0.0.0')
