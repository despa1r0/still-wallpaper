resource "aws_security_group" "app" {
  name        = "wallpaper-app-sg"
  description = "Security group settings for walppaper app"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "wallpaper-app-sg"
  }

}


resource "aws_vpc_security_group_ingress_rule" "app_port" {
  security_group_id = aws_security_group.app.id

  from_port   = 8000
  to_port     = 8000
  ip_protocol = "tcp"
  cidr_ipv4   = "0.0.0.0/0"

}

resource "aws_vpc_security_group_egress_rule" "all" {

  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"

}